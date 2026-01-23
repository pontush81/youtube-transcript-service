import { NextRequest } from 'next/server';
import { getAIProvider } from '@/lib/ai/provider';
import { searchTranscripts } from '@/lib/vector-search';
import { Message } from '@/lib/ai/types';
import { rewriteQueryWithContext } from '@/lib/ai/query-rewriter';
import { checkRateLimit, RATE_LIMITS, getClientIdentifier } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 30;

// Limit conversation history to prevent token overflow
const MAX_HISTORY_MESSAGES = 10;

interface ChatRequest {
  message: string;
  conversationHistory: Message[];
  selectedVideos: string[] | 'all';
  mode: 'strict' | 'hybrid';
}

export async function POST(request: NextRequest) {
  // Rate limiting
  const clientId = getClientIdentifier(request);
  const rateLimit = checkRateLimit(`chat:${clientId}`, RATE_LIMITS.chat);

  if (!rateLimit.allowed) {
    return new Response(
      JSON.stringify({
        error: 'För många förfrågningar. Vänta en stund.',
        retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(rateLimit.resetAt),
        },
      }
    );
  }

  try {
    const body: ChatRequest = await request.json();
    const { message, conversationHistory: rawHistory, selectedVideos, mode } = body;

    if (!message?.trim()) {
      return new Response(
        JSON.stringify({ error: 'Meddelande krävs' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Limit conversation history to last N messages
    const conversationHistory = rawHistory.slice(-MAX_HISTORY_MESSAGES);

    // Handle empty selection edge case
    if (Array.isArray(selectedVideos) && selectedVideos.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Välj minst en video' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Rewrite query with conversation context for better search
    const searchQuery = await rewriteQueryWithContext(message, conversationHistory);

    // Search for relevant transcript chunks
    const relevantChunks = await searchTranscripts({
      query: searchQuery,
      videoIds: selectedVideos,
    });

    // Get AI provider
    const provider = getAIProvider('openai');

    // Build messages array
    const messages: Message[] = [
      ...conversationHistory,
      { role: 'user', content: message },
    ];

    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // First, send the sources as a JSON line
          const sources = [...new Map(
            relevantChunks.map(chunk => [
              chunk.videoId,
              {
                videoId: chunk.videoId,
                title: chunk.videoTitle,
                timestamp: chunk.timestampStart,
              }
            ])
          ).values()];

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'sources', sources })}\n\n`)
          );

          // Then stream the chat response
          for await (const text of provider.chat({ messages, context: relevantChunks, mode })) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'content', content: text })}\n\n`)
            );
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
          controller.close();
        } catch (error) {
          console.error('Stream error:', error);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'error', error: 'Ett fel uppstod' })}\n\n`)
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Chat error:', error);
    return new Response(
      JSON.stringify({ error: 'Ett fel uppstod' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
