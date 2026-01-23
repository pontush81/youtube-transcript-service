import { NextRequest, NextResponse } from 'next/server';
import { hasValidAdminKey } from '@/lib/admin';
import { sql } from '@/lib/db';

// Temporary endpoint to add test category data
export async function POST(request: NextRequest) {
  if (!hasValidAdminKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Update a few videos with test category data
    await sql`
      UPDATE video_metadata
      SET category_id = 27, category_name = 'Education'
      WHERE video_id IN (
        SELECT video_id FROM video_metadata LIMIT 3
      )
    `;

    await sql`
      UPDATE video_metadata
      SET category_id = 28, category_name = 'Science & Technology'
      WHERE video_id IN (
        SELECT video_id FROM video_metadata OFFSET 3 LIMIT 3
      )
    `;

    await sql`
      UPDATE video_metadata
      SET category_id = 24, category_name = 'Entertainment'
      WHERE video_id IN (
        SELECT video_id FROM video_metadata OFFSET 6 LIMIT 4
      )
    `;

    // Check results
    const result = await sql`
      SELECT category_id, category_name, COUNT(*) as count
      FROM video_metadata
      WHERE category_id IS NOT NULL
      GROUP BY category_id, category_name
    `;

    return NextResponse.json({
      success: true,
      categories: result.rows,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    );
  }
}
