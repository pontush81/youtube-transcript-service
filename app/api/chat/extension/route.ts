import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { searchTranscripts } from '@/lib/vector-search';
import { checkRateLimit, getClientIdentifier, rateLimitHeaders } from '@/lib/rate-limit';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { checkUsage, incrementUsage, getUserPlan } from '@/lib/usage';
import { z } from 'zod';

export const maxDuration = 30;

const requestSchema = z.object({
  videoId: z.string().regex(/^[\w-]{11}$/, 'Invalid video ID'),
  message: z.string().min(1).max(10000),
  conversationHistory: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(10000),
  })).max(20).default([]),
});

const SYSTEM_PROMPT = `You are a helpful assistant that answers questions about YouTube video transcripts.
Answer based on the transcript context provided below. If the context doesn't contain relevant information, say so clearly.
Reply in the same language as the user's question.`;

export async function POST(request: NextRequest) {
  const clientId = getClientIdentifier(request);
  const rateLimit = await checkRateLimit('summary', clientId);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait.', retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000) },
      { status: 429, headers: rateLimitHeaders(rateLimit) }
    );
  }

  // Daily usage gating (separate from IP rate limit above)
  const { userId } = await auth();

  let plan: 'free' | 'pro' = 'free';
  if (userId) {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    plan = getUserPlan(user.publicMetadata);
  }

  const usage = await checkUsage(userId, 'chat', plan);
  if (!usage.allowed) {
    return NextResponse.json(
      {
        error: 'Daily chat limit reached. Upgrade to Pro for unlimited chat.',
        upgrade: true,
        used: usage.used,
        limit: usage.limit,
      },
      { status: 402 }
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'AI chat not configured' }, { status: 503 });
  }

  try {
    const raw = await request.json();
    const parsed = requestSchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid request' }, { status: 400 });
    }

    const { videoId, message, conversationHistory } = parsed.data;

    // Search for relevant transcript chunks
    const relevantChunks = await searchTranscripts({
      query: message,
      videoIds: [videoId],
    });

    // Build context from chunks
    let context = '';
    if (relevantChunks.length > 0) {
      context = '\n\nTRANSCRIPT CONTEXT:\n';
      for (const chunk of relevantChunks) {
        const ts = chunk.timestampStart ? ` @ ${chunk.timestampStart}` : '';
        context += `---\n[Video: "${chunk.videoTitle}"${ts}]\n${chunk.content}\n`;
      }
    }

    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT + context },
        ...conversationHistory.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        { role: 'user', content: message },
      ],
    });

    const response = completion.choices[0]?.message?.content || '';

    await incrementUsage(userId, 'chat');

    return NextResponse.json({ response });
  } catch (error) {
    console.error('Chat extension error:', error);
    return NextResponse.json({ error: 'Failed to generate response' }, { status: 500 });
  }
}
