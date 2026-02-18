import { NextRequest, NextResponse } from 'next/server';
import { hasValidAdminKey } from '@/lib/admin';
import { sql } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  if (!hasValidAdminKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Add category_id column if not exists
    await sql`
      ALTER TABLE video_metadata
      ADD COLUMN IF NOT EXISTS category_id INTEGER
    `;

    // Add category_name column if not exists
    await sql`
      ALTER TABLE video_metadata
      ADD COLUMN IF NOT EXISTS category_name TEXT
    `;

    // Create index on category_id for filtering
    await sql`
      CREATE INDEX IF NOT EXISTS video_metadata_category_idx
      ON video_metadata(category_id)
    `;

    return NextResponse.json({
      success: true,
      message: 'category_id and category_name columns added successfully',
    });
  } catch (error) {
    logger.error('Migration error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Migration failed' },
      { status: 500 }
    );
  }
}
