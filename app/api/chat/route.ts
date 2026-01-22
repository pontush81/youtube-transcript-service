import { NextRequest } from 'next/server';
import { getAIProvider } from '@/lib/ai/provider';
import { searchTranscripts } from '@/lib/vector-search';
import { Message } from '@/lib/ai/types';

export const runtime = 'nodejs';
export const maxDuration = 30;

interface ChatRequest {
  message: string;
  conversationHistory: Message[];
  selectedVideos: string[] | 'all';
  mode: 'strict' | 'hybrid';
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const { message, conversationHistory, selectedVideos, mode } = body;

    if (!message?.trim()) {
      return new Response(
        JSON.stringify({ error: 'Meddelande krävs' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Search for relevant transcript chunks
    const relevantChunks = await searchTranscripts({
      query: message,
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
