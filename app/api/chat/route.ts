import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getAIProvider } from '@/lib/ai/provider';
import { searchTranscripts } from '@/lib/vector-search';
import { Message } from '@/lib/ai/types';
import { rewriteQueryWithContext } from '@/lib/ai/query-rewriter';
import { checkRateLimit, getClientIdentifier, rateLimitHeaders } from '@/lib/rate-limit';
import { chatRequestSchema, parseRequest } from '@/lib/validations';
import { canUse, logUsage } from '@/lib/usage';
import { isUserAdmin } from '@/lib/admin';

export const runtime = 'nodejs';
export const maxDuration = 30;

// Limit conversation history to prevent token overflow
const MAX_HISTORY_MESSAGES = 10;

export async function POST(request: NextRequest) {
  // Auth check
  const { userId } = await auth();
  if (!userId) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Check if user is admin (admins skip credit checks)
  const isAdmin = await isUserAdmin(userId);

  // Usage check (skip for admins)
  if (!isAdmin) {
    const allowed = await canUse(userId, 'chat');
    if (!allowed) {
      return new Response(
        JSON.stringify({
          error: "You've reached your daily limit. Upgrade to Pro for more.",
          code: 'USAGE_LIMIT'
        }),
        { status: 402, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  // Rate limiting
  const clientId = getClientIdentifier(request);
  const rateLimit = await checkRateLimit('chat', clientId);

  if (!rateLimit.allowed) {
    return new Response(
      JSON.stringify({
        error: 'Too many requests. Please wait.',
        retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          ...rateLimitHeaders(rateLimit),
        },
      }
    );
  }

  try {
    const rawBody = await request.json();
    const parsed = parseRequest(chatRequestSchema, rawBody);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { message, conversationHistory: rawHistory, selectedVideos, mode } = parsed.data;

    // Limit conversation history to last N messages
    const conversationHistory = rawHistory.slice(-MAX_HISTORY_MESSAGES);

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

    // Log usage (skip for admins)
    if (!isAdmin) {
      const logged = await logUsage(userId, 'chat');
      if (!logged) {
        return new Response(
          JSON.stringify({
            error: "You've reached your daily limit. Upgrade to Pro for more.",
            code: 'USAGE_LIMIT'
          }),
          { status: 402, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

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
            encoder.encode(`data: ${JSON.stringify({ type: 'error', error: 'An error occurred' })}\n\n`)
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
      JSON.stringify({ error: 'An error occurred' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
