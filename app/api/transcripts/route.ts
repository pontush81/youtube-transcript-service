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
  // Metadata fields
  thumbnailUrl?: string;
  channelId?: string;
  channelName?: string;
  durationSeconds?: number;
  publishedAt?: string;
  viewCount?: number;
  tags?: string[];
  categoryId?: number;
  categoryName?: string;
}

export interface Channel {
  channelId: string;
  channelName: string;
  videoCount: number;
}

export interface Category {
  categoryId: number;
  categoryName: string;
  videoCount: number;
}

export async function GET(request: NextRequest) {
  try {
    // Check if user is logged in
    const { userId } = await auth();

    // Check for filters
    const showMyOnly = request.nextUrl.searchParams.get('my') === 'true';
    const channelFilter = request.nextUrl.searchParams.get('channel');
    const categoryFilter = request.nextUrl.searchParams.get('category');
    const sortBy = request.nextUrl.searchParams.get('sort') || 'uploadedAt';
    const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') || '100', 10), 500);
    const offset = Math.max(parseInt(request.nextUrl.searchParams.get('offset') || '0', 10), 0);

    // Run all data fetches in parallel
    const [userTranscriptsResult, cachedTitles, metadataResult, blobsResult] = await Promise.all([
      userId
        ? sql`SELECT video_id FROM user_transcripts WHERE user_id = ${userId}`
        : Promise.resolve({ rows: [] }),
      sql`
        SELECT DISTINCT ON (video_id) video_id, video_title
        FROM transcript_chunks
        ORDER BY video_id, created_at DESC
      `,
      sql`SELECT * FROM video_metadata`,
      list({ prefix: 'transcripts/' }),
    ]);

    const userTranscriptIds = new Set<string>(
      userTranscriptsResult.rows.map(r => r.video_id)
    );

    const titleCache = new Map(
      cachedTitles.rows.map(r => [r.video_id, r.video_title as string])
    );

    const metadataMap = new Map(
      metadataResult.rows.map(r => [r.video_id, r])
    );

    const { blobs } = blobsResult;

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

    // Build transcripts list synchronously - no per-item fetches
    const allTranscripts: TranscriptItem[] = Array.from(videoMap.values()).map(({ blob, normalizedId }) => {
      const isOwner = userTranscriptIds.has(normalizedId);
      const metadata = metadataMap.get(normalizedId);

      // Title priority: metadata > transcript_chunks cache > videoId
      const title = metadata?.title || titleCache.get(normalizedId) || normalizedId;

      return {
        videoId: normalizedId,
        title,
        url: blob.url,
        uploadedAt: blob.uploadedAt,
        size: blob.size,
        indexed: titleCache.has(normalizedId),
        isOwner,
        thumbnailUrl: metadata?.thumbnail_url || undefined,
        channelId: metadata?.channel_id || undefined,
        channelName: metadata?.channel_name || undefined,
        durationSeconds: metadata?.duration_seconds || undefined,
        publishedAt: metadata?.published_at || undefined,
        viewCount: metadata?.view_count || undefined,
        tags: metadata?.tags || undefined,
        categoryId: metadata?.category_id || undefined,
        categoryName: metadata?.category_name || undefined,
      };
    });

    // Apply filters
    let transcripts = allTranscripts;

    if (showMyOnly) {
      transcripts = transcripts.filter(t => t.isOwner);
    }

    if (channelFilter) {
      transcripts = transcripts.filter(t => t.channelId === channelFilter);
    }

    if (categoryFilter) {
      const catId = parseInt(categoryFilter, 10);
      transcripts = transcripts.filter(t => t.categoryId === catId);
    }

    // Sort
    switch (sortBy) {
      case 'duration':
        transcripts.sort((a, b) => (b.durationSeconds || 0) - (a.durationSeconds || 0));
        break;
      case 'views':
        transcripts.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
        break;
      case 'published':
        transcripts.sort((a, b) => {
          const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
          const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
          return dateB - dateA;
        });
        break;
      case 'title':
        transcripts.sort((a, b) => a.title.localeCompare(b.title, 'sv'));
        break;
      case 'uploadedAt':
      default:
        transcripts.sort((a, b) =>
          new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
        );
    }

    // Get unique channels for filter dropdown
    const channelMap = new Map<string, { name: string; count: number }>();
    for (const t of allTranscripts) {
      if (t.channelId && t.channelName) {
        const existing = channelMap.get(t.channelId);
        if (existing) {
          existing.count++;
        } else {
          channelMap.set(t.channelId, { name: t.channelName, count: 1 });
        }
      }
    }

    const channels: Channel[] = Array.from(channelMap.entries())
      .map(([id, data]) => ({
        channelId: id,
        channelName: data.name,
        videoCount: data.count,
      }))
      .sort((a, b) => b.videoCount - a.videoCount);

    // Get unique categories for filter dropdown
    const categoryMap = new Map<number, { name: string; count: number }>();
    for (const t of allTranscripts) {
      if (t.categoryId && t.categoryName) {
        const existing = categoryMap.get(t.categoryId);
        if (existing) {
          existing.count++;
        } else {
          categoryMap.set(t.categoryId, { name: t.categoryName, count: 1 });
        }
      }
    }

    const categories: Category[] = Array.from(categoryMap.entries())
      .map(([id, data]) => ({
        categoryId: id,
        categoryName: data.name,
        videoCount: data.count,
      }))
      .sort((a, b) => b.videoCount - a.videoCount);

    // Apply pagination
    const total = transcripts.length;
    const paginatedTranscripts = transcripts.slice(offset, offset + limit);

    return NextResponse.json(
      {
        transcripts: paginatedTranscripts,
        channels,
        categories,
        isAuthenticated: !!userId,
        userTranscriptCount: userTranscriptIds.size,
        pagination: { total, limit, offset },
      },
      {
        headers: {
          // Don't cache when authenticated (personalized content)
          'Cache-Control': userId
            ? 'private, max-age=300'
            : 'public, s-maxage=60, stale-while-revalidate=300',
        },
      }
    );
  } catch (error) {
    console.error('Error listing transcripts:', error);
    return NextResponse.json(
      { success: false, error: 'Kunde inte hämta transkript-lista' },
      { status: 500 }
    );
  }
}
