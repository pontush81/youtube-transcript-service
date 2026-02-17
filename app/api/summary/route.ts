import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { checkRateLimit, getClientIdentifier, rateLimitHeaders } from '@/lib/rate-limit';

export const maxDuration = 30;

const SUMMARY_PROMPT = `You are a helpful assistant that summarizes YouTube video transcripts.
Given the transcript below, provide:

## Key Takeaways
- 3-5 bullet points of the most important points

## Summary
A concise 2-3 paragraph summary of the video content.

Write in the same language as the transcript.`;

export async function POST(request: NextRequest) {
  const clientId = getClientIdentifier(request);
  const rateLimit = await checkRateLimit('chat', clientId);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait.', retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000) },
      { status: 429, headers: rateLimitHeaders(rateLimit) }
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'AI summarization not configured' }, { status: 503 });
  }

  try {
    const { transcript } = await request.json();

    if (!transcript || typeof transcript !== 'string') {
      return NextResponse.json({ error: 'transcript is required' }, { status: 400 });
    }

    // Truncate to ~12k tokens worth of text to stay within limits
    const truncated = transcript.slice(0, 48000);

    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SUMMARY_PROMPT },
        { role: 'user', content: truncated },
      ],
    });

    const summary = completion.choices[0]?.message?.content || '';

    return NextResponse.json({ summary });
  } catch (error) {
    console.error('Summary error:', error);
    return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 });
  }
}
