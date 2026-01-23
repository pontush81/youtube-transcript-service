import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { sql } from '@/lib/db';

function secureCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) {
    timingSafeEqual(aBuffer, aBuffer);
    return false;
  }
  return timingSafeEqual(aBuffer, bBuffer);
}

export async function POST(request: NextRequest) {
  // Require admin key for security
  const adminKey = request.headers.get('x-admin-key');
  const validKey = process.env.ADMIN_KEY;

  if (!adminKey || !validKey || !secureCompare(adminKey, validKey)) {
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
    console.error('Migration error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Migration failed' },
      { status: 500 }
    );
  }
}
