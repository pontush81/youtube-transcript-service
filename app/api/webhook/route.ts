import { NextRequest, NextResponse } from 'next/server';
import { extractVideoId, fetchTranscript, fetchVideoTitle } from '@/lib/youtube';
import { generateMarkdown } from '@/lib/markdown';
import { saveToBlob } from '@/lib/storage';
import { checkRateLimit, getClientIdentifier, rateLimitHeaders } from '@/lib/rate-limit';
import { secureCompare } from '@/lib/admin';

// Removed edge runtime - youtube-transcript requires Node.js

export async function GET(request: NextRequest) {
  // API key authentication
  const apiKey = request.nextUrl.searchParams.get('key') || request.headers.get('x-api-key');
  const validKey = process.env.WEBHOOK_API_KEY || process.env.ADMIN_KEY;
  if (!validKey || !apiKey || !secureCompare(apiKey, validKey)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limiting
  const clientId = getClientIdentifier(request);
  const rateLimit = await checkRateLimit('transcript', clientId);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { success: false, error: 'Too many requests', retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000) },
      { status: 429, headers: rateLimitHeaders(rateLimit) }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json(
      { success: false, error: 'Parameter "url" krävs' },
      { status: 400 }
    );
  }

  const videoId = extractVideoId(url);

  if (!videoId) {
    return NextResponse.json(
      { success: false, error: 'Ogiltig YouTube URL' },
      { status: 400 }
    );
  }

  let title: string;
  try {
    title = await fetchVideoTitle(videoId);
  } catch {
    return NextResponse.json(
      { success: false, error: 'Videon kunde inte hittas eller är privat' },
      { status: 404 }
    );
  }

  let transcript: string;
  try {
    transcript = await fetchTranscript(videoId);
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: 'Transkript saknas för denna video',
      },
      { status: 404 }
    );
  }

  const markdown = generateMarkdown(transcript, {
    title,
    videoId,
    url,
    createdAt: new Date().toISOString(),
  });

  let downloadUrl: string;
  try {
    downloadUrl = await saveToBlob(videoId, markdown);
  } catch {
    return NextResponse.json(
      { success: false, error: 'Kunde inte spara filen' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    videoId,
    title,
    downloadUrl,
    transcriptLength: transcript.length,
  });
}
