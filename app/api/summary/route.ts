import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { checkRateLimit, getClientIdentifier, rateLimitHeaders } from '@/lib/rate-limit';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { checkUsage, incrementUsage, getUserPlan } from '@/lib/usage';
import { z } from 'zod';

export const maxDuration = 30;

const summaryRequestSchema = z.object({
  transcript: z.string().min(50, 'Transcript too short').max(100000, 'Transcript too long'),
});

const SUMMARY_PROMPT = `You are a helpful assistant that summarizes YouTube video transcripts.
Given the transcript below, provide:

## Key Takeaways
- 3-5 bullet points of the most important points

## Summary
A concise 2-3 paragraph summary of the video content.

Write in the same language as the transcript.`;

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

  const usage = await checkUsage(userId, 'summary', plan);
  if (!usage.allowed) {
    return NextResponse.json(
      {
        error: 'Daily summary limit reached. Upgrade to Pro for unlimited summaries.',
        upgrade: true,
        used: usage.used,
        limit: usage.limit,
      },
      { status: 402 }
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'AI summarization not configured' }, { status: 503 });
  }

  try {
    const raw = await request.json();
    const parsed = summaryRequestSchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid request' }, { status: 400 });
    }

    // Truncate to ~12k tokens worth of text to stay within limits
    const truncated = parsed.data.transcript.slice(0, 48000);

    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SUMMARY_PROMPT },
        { role: 'user', content: truncated },
      ],
    });

    const summary = completion.choices[0]?.message?.content || '';

    await incrementUsage(userId, 'summary');

    return NextResponse.json({ summary });
  } catch (error) {
    console.error('Summary error:', error);
    return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 });
  }
}
