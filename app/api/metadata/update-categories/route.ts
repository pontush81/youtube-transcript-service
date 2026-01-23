import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { fetchVideoMetadata } from '@/lib/youtube';
import { hasValidAdminKey } from '@/lib/admin';

export const maxDuration = 300; // 5 minutes

export async function POST(request: NextRequest) {
  if (!hasValidAdminKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const limit = Math.min(body.limit || 20, 100);

    // Get videos without category data
    const result = await sql`
      SELECT video_id FROM video_metadata
      WHERE category_id IS NULL
      LIMIT ${limit}
    `;

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All videos already have category data',
        updated: 0,
        remaining: 0,
      });
    }

    const results: Array<{
      videoId: string;
      success: boolean;
      categoryName?: string;
      error?: string;
    }> = [];

    for (const row of result.rows) {
      try {
        const metadata = await fetchVideoMetadata(row.video_id);

        if (metadata.categoryId) {
          await sql`
            UPDATE video_metadata
            SET category_id = ${metadata.categoryId},
                category_name = ${metadata.categoryName},
                updated_at = NOW()
            WHERE video_id = ${row.video_id}
          `;
          results.push({
            videoId: row.video_id,
            success: true,
            categoryName: metadata.categoryName || undefined,
          });
        } else {
          results.push({
            videoId: row.video_id,
            success: false,
            error: 'No category in API response',
          });
        }
      } catch (error) {
        results.push({
          videoId: row.video_id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Count remaining
    const remainingResult = await sql`
      SELECT COUNT(*) as count FROM video_metadata WHERE category_id IS NULL
    `;
    const remaining = parseInt(remainingResult.rows[0]?.count || '0', 10);

    const successful = results.filter(r => r.success).length;

    return NextResponse.json({
      success: true,
      message: `Updated ${successful} of ${result.rows.length} videos`,
      updated: successful,
      failed: results.filter(r => !r.success).length,
      remaining,
      results,
    });
  } catch (error) {
    console.error('Category update error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Update failed' },
      { status: 500 }
    );
  }
}
