import { list } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';
import { extractYouTubeVideoId } from '@/lib/video-utils';
import { sql } from '@/lib/db';
import { auth } from '@clerk/nextjs/server';

// Remove edge runtime - need nodejs for database access
// export const runtime = 'edge';

export interface TranscriptItem {
  videoId: string;
  title: string;
  url: string;
  uploadedAt: Date;
  size: number;
  indexed: boolean;
  isOwner?: boolean;
}

// Extract title from Markdown content (first line is always "# {title}")
function extractTitleFromMarkdown(content: string): string | null {
  const firstLine = content.split('\n')[0];
  if (firstLine?.startsWith('# ')) {
    return firstLine.substring(2).trim();
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    // Check if user is logged in
    const { userId } = await auth();

    // Get user's transcripts if logged in
    const userTranscriptIds = new Set<string>();
    if (userId) {
      const userTranscripts = await sql`
        SELECT video_id FROM user_transcripts WHERE user_id = ${userId}
      `;
      userTranscripts.rows.forEach(r => userTranscriptIds.add(r.video_id));
    }

    // Check for "my" filter
    const showMyOnly = request.nextUrl.searchParams.get('my') === 'true';

    // Get cached titles from database (fast)
    const cachedTitles = await sql`
      SELECT DISTINCT ON (video_id) video_id, video_title, blob_url
      FROM transcript_chunks
      ORDER BY video_id, created_at DESC
    `;
    const titleCache = new Map(
      cachedTitles.rows.map(r => [r.video_id, { title: r.video_title, blobUrl: r.blob_url }])
    );

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

    // Build transcripts list - use cached titles when available
    const allTranscripts: TranscriptItem[] = await Promise.all(
      Array.from(videoMap.values()).map(async ({ blob, normalizedId }) => {
        const isOwner = userTranscriptIds.has(normalizedId);

        // Try to get title from cache first (fast path)
        const cached = titleCache.get(normalizedId);
        if (cached) {
          return {
            videoId: normalizedId,
            title: cached.title,
            url: blob.url,
            uploadedAt: blob.uploadedAt,
            size: blob.size,
            indexed: true,
            isOwner,
          };
        }

        // Fallback: fetch from blob (slow path - only for non-indexed videos)
        let title = normalizedId;
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
          indexed: false,
          isOwner,
        };
      })
    );

    // Filter to user's transcripts if requested
    const transcripts = showMyOnly
      ? allTranscripts.filter(t => t.isOwner)
      : allTranscripts;

    // Sort by upload date (newest first)
    transcripts.sort((a, b) =>
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    );

    return NextResponse.json(
      {
        transcripts,
        isAuthenticated: !!userId,
        userTranscriptCount: userTranscriptIds.size,
      },
      {
        headers: {
          // Don't cache when authenticated (personalized content)
          'Cache-Control': userId
            ? 'private, no-cache'
            : 'public, s-maxage=60, stale-while-revalidate=300',
        },
      }
    );
  } catch (error) {
    console.error('Error listing transcripts:', error);
    return NextResponse.json(
      { error: 'Kunde inte hämta transkript-lista' },
      { status: 500 }
    );
  }
}
