import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { list } from '@vercel/blob';
import { sql } from '@/lib/db';
import { fetchAndSaveVideoMetadata } from '@/lib/video-metadata';
import { extractYouTubeVideoId } from '@/lib/video-utils';

export const maxDuration = 300; // 5 minutes for backfill

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Optional: require admin key for large backfills
  const adminKey = request.headers.get('x-admin-key');
  const isAdmin = adminKey === process.env.ADMIN_KEY;

  try {
    const body = await request.json().catch(() => ({}));
    const limit = Math.min(body.limit || 10, isAdmin ? 100 : 10);

    // Get all video IDs from blobs
    const { blobs } = await list({ prefix: 'transcripts/' });

    // Get existing metadata
    const existingMetadata = await sql`SELECT video_id FROM video_metadata`;
    const existingIds = new Set(existingMetadata.rows.map(r => r.video_id));

    // Find videos without metadata
    const videoIds = new Set<string>();
    for (const blob of blobs) {
      const filename = blob.pathname.replace('transcripts/', '').replace('.md', '');
      const normalizedId = extractYouTubeVideoId(filename);
      if (!existingIds.has(normalizedId)) {
        videoIds.add(normalizedId);
      }
    }

    const missingIds = Array.from(videoIds).slice(0, limit);

    if (missingIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All videos already have metadata',
        processed: 0,
        remaining: 0,
      });
    }

    const results: Array<{
      videoId: string;
      success: boolean;
      error?: string;
    }> = [];

    for (const videoId of missingIds) {
      try {
        await fetchAndSaveVideoMetadata(videoId);
        results.push({ videoId, success: true });
      } catch (error) {
        results.push({
          videoId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    const successful = results.filter(r => r.success).length;
    const remaining = videoIds.size - missingIds.length;

    return NextResponse.json({
      success: true,
      message: `Processed ${successful} of ${missingIds.length} videos`,
      processed: successful,
      failed: results.filter(r => !r.success).length,
      remaining,
      results,
    });
  } catch (error) {
    console.error('Backfill error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Backfill failed' },
      { status: 500 }
    );
  }
}

// GET to check status
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { blobs } = await list({ prefix: 'transcripts/' });
    const metadataCount = await sql`SELECT COUNT(*) as count FROM video_metadata`;

    // Count unique video IDs
    const videoIds = new Set<string>();
    for (const blob of blobs) {
      const filename = blob.pathname.replace('transcripts/', '').replace('.md', '');
      const normalizedId = extractYouTubeVideoId(filename);
      videoIds.add(normalizedId);
    }

    const totalVideos = videoIds.size;
    const withMetadata = parseInt(metadataCount.rows[0]?.count || '0', 10);

    return NextResponse.json({
      totalVideos,
      withMetadata,
      missing: totalVideos - withMetadata,
      percentComplete: totalVideos > 0
        ? Math.round((withMetadata / totalVideos) * 100)
        : 100,
    });
  } catch (error) {
    console.error('Status check error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Status check failed' },
      { status: 500 }
    );
  }
}
