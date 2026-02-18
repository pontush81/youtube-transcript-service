import { NextRequest, NextResponse } from 'next/server';
import { hasValidAdminKey } from '@/lib/admin';
import { sql } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  if (!hasValidAdminKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Create video_metadata table
    await sql`
      CREATE TABLE IF NOT EXISTS video_metadata (
        video_id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        duration_seconds INTEGER,
        channel_id TEXT,
        channel_name TEXT,
        thumbnail_url TEXT,
        published_at TIMESTAMPTZ,
        view_count INTEGER,
        like_count INTEGER,
        tags TEXT[],
        transcript_language TEXT,
        fetched_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // Create indexes
    await sql`
      CREATE INDEX IF NOT EXISTS video_metadata_channel_idx
      ON video_metadata(channel_id)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS video_metadata_published_idx
      ON video_metadata(published_at DESC)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS video_metadata_views_idx
      ON video_metadata(view_count DESC NULLS LAST)
    `;

    return NextResponse.json({
      success: true,
      message: 'video_metadata table created successfully',
    });
  } catch (error) {
    logger.error('Migration error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Migration failed' },
      { status: 500 }
    );
  }
}
