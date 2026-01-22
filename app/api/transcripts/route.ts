import { list } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { extractYouTubeVideoId } from '@/lib/video-utils';

export const runtime = 'edge';

export interface TranscriptItem {
  videoId: string;
  title: string;
  url: string;
  uploadedAt: Date;
  size: number;
}

// Extract title from Markdown content (first line is always "# {title}")
function extractTitleFromMarkdown(content: string): string | null {
  const firstLine = content.split('\n')[0];
  if (firstLine?.startsWith('# ')) {
    return firstLine.substring(2).trim();
  }
  return null;
}

export async function GET() {
  try {
    const { blobs } = await list({ prefix: 'transcripts/' });

    // Map to store unique videos by normalized ID (keep newest)
    const videoMap = new Map<string, {
      blob: typeof blobs[0];
      normalizedId: string;
    }>();

    // Sort blobs by upload date (newest first) before processing
    const sortedBlobs = [...blobs].sort((a, b) =>
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    );

    // Keep only the newest blob for each normalized video ID
    for (const blob of sortedBlobs) {
      const filename = blob.pathname.replace('transcripts/', '').replace('.md', '');
      const normalizedId = extractYouTubeVideoId(filename);

      // Only keep first (newest) occurrence of each video
      if (!videoMap.has(normalizedId)) {
        videoMap.set(normalizedId, { blob, normalizedId });
      }
    }

    // Fetch titles for unique videos
    const transcripts: TranscriptItem[] = await Promise.all(
      Array.from(videoMap.values()).map(async ({ blob, normalizedId }) => {
        let title = normalizedId; // Fallback to videoId

        try {
          const response = await fetch(blob.url);
          if (response.ok) {
            const text = await response.text();
            const extractedTitle = extractTitleFromMarkdown(text);
            if (extractedTitle) {
              title = extractedTitle;
            }
          }
        } catch {
          // If file can't be fetched, use videoId
        }

        return {
          videoId: normalizedId,
          title,
          url: blob.url,
          uploadedAt: blob.uploadedAt,
          size: blob.size,
        };
      })
    );

    // Sort by upload date (newest first)
    transcripts.sort((a, b) =>
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    );

    return NextResponse.json({ transcripts });
  } catch (error) {
    console.error('Error listing transcripts:', error);
    return NextResponse.json(
      { error: 'Kunde inte hämta transkript-lista' },
      { status: 500 }
    );
  }
}
