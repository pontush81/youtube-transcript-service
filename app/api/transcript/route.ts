import { NextRequest, NextResponse } from 'next/server';
import { extractVideoId, fetchTranscript, fetchVideoTitle } from '@/lib/youtube';
import { generateMarkdown } from '@/lib/markdown';
import { saveToBlob } from '@/lib/storage';
import { saveTranscriptEmbeddings } from '@/lib/embeddings';
import { checkRateLimit, getClientIdentifier, rateLimitHeaders } from '@/lib/rate-limit';
import { transcriptSubmitSchema, parseRequest } from '@/lib/validations';
import { auth } from '@clerk/nextjs/server';
import { sql } from '@/lib/db';

// Remove edge runtime - Vercel Postgres doesn't work with Edge
// export const runtime = 'edge';

export async function POST(request: NextRequest) {
  // Rate limiting
  const clientId = getClientIdentifier(request);
  const rateLimit = await checkRateLimit('transcript', clientId);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: 'För många förfrågningar. Vänta en stund.',
        retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
      },
      { status: 429, headers: rateLimitHeaders(rateLimit) }
    );
  }

  try {
    const rawBody = await request.json();
    const parsed = parseRequest(transcriptSubmitSchema, rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error },
        { status: 400 }
      );
    }

    const { url, submitter, tags, notes } = parsed.data;
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
          error: 'Transkript saknas för denna video. Videon har förmodligen inga captions.',
        },
        { status: 404 }
      );
    }

    const markdown = generateMarkdown(transcript, {
      title,
      videoId,
      url,
      submitter,
      tags,
      notes,
      createdAt: new Date().toISOString(),
    });

    let downloadUrl: string;
    try {
      downloadUrl = await saveToBlob(videoId, markdown);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Kunde inte spara filen. Försök igen.' },
        { status: 500 }
      );
    }

    // Generate and save embeddings for chat functionality
    let embeddingResult = { chunksCreated: 0, valid: false, reason: '' };
    try {
      const result = await saveTranscriptEmbeddings({
        blobUrl: downloadUrl,
        videoId,
        videoTitle: title,
        markdownContent: markdown,
      });
      embeddingResult = {
        chunksCreated: result.chunksCreated,
        valid: result.validation.valid,
        reason: result.validation.reason || '',
      };
    } catch (error) {
      // Log but don't fail - embeddings are optional
      console.error('Failed to create embeddings:', error);
    }

    // Link transcript to user if logged in
    const { userId } = await auth();
    if (userId) {
      try {
        await sql`
          INSERT INTO user_transcripts (user_id, video_id, blob_url, is_public)
          VALUES (${userId}, ${videoId}, ${downloadUrl}, true)
          ON CONFLICT (user_id, video_id) DO UPDATE SET
            blob_url = EXCLUDED.blob_url,
            is_public = EXCLUDED.is_public
        `;
      } catch (error) {
        // Log but don't fail - linking is optional
        console.error('Failed to link transcript to user:', error);
      }
    }

    return NextResponse.json({
      success: true,
      videoId,
      title,
      downloadUrl,
      chunksCreated: embeddingResult.chunksCreated,
      embeddingStatus: embeddingResult.valid ? 'indexed' : 'skipped',
      embeddingReason: embeddingResult.reason || undefined,
      preview: transcript.substring(0, 500) + (transcript.length > 500 ? '...' : ''),
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Ett oväntat fel uppstod' },
      { status: 500 }
    );
  }
}
