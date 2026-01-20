import { NextRequest, NextResponse } from 'next/server';
import { extractVideoId, fetchTranscript, fetchVideoTitle } from '@/lib/youtube';
import { generateMarkdown } from '@/lib/markdown';
import { saveToBlob } from '@/lib/storage';
import { formatTranscriptWithAI } from '@/lib/format-ai';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
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

  // Formatera transkriptet med AI för bättre läsbarhet
  const formattedTranscript = await formatTranscriptWithAI(transcript, title);

  const markdown = generateMarkdown(formattedTranscript, {
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
