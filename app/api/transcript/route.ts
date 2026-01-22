import { NextRequest, NextResponse } from 'next/server';
import { extractVideoId, fetchTranscript, fetchVideoTitle } from '@/lib/youtube';
import { generateMarkdown } from '@/lib/markdown';
import { saveToBlob } from '@/lib/storage';
import { saveTranscriptEmbeddings } from '@/lib/embeddings';

// Remove edge runtime - Vercel Postgres doesn't work with Edge
// export const runtime = 'edge';

interface TranscriptRequest {
  url: string;
  submitter?: string;
  tags?: string[];
  notes?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: TranscriptRequest = await request.json();
    const { url, submitter, tags, notes } = body;

    if (!url) {
      return NextResponse.json(
        { success: false, error: 'YouTube URL krävs' },
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
    let chunksCreated = 0;
    try {
      chunksCreated = await saveTranscriptEmbeddings({
        blobUrl: downloadUrl,
        videoId,
        videoTitle: title,
        markdownContent: markdown,
      });
    } catch (error) {
      // Log but don't fail - embeddings are optional
      console.error('Failed to create embeddings:', error);
    }

    return NextResponse.json({
      success: true,
      videoId,
      title,
      downloadUrl,
      chunksCreated,
      preview: transcript.substring(0, 500) + (transcript.length > 500 ? '...' : ''),
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Ett oväntat fel uppstod' },
      { status: 500 }
    );
  }
}
