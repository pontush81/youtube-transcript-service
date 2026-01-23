import { NextRequest, NextResponse } from 'next/server';
import { hasValidAdminKey } from '@/lib/admin';
import { sql } from '@/lib/db';

export async function POST(request: NextRequest) {
  if (!hasValidAdminKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Add content_type column
    await sql`
      ALTER TABLE user_transcripts
      ADD COLUMN IF NOT EXISTS content_type TEXT DEFAULT 'youtube'
    `;

    // Add title column
    await sql`
      ALTER TABLE user_transcripts
      ADD COLUMN IF NOT EXISTS title TEXT
    `;

    // Add source_url column
    await sql`
      ALTER TABLE user_transcripts
      ADD COLUMN IF NOT EXISTS source_url TEXT
    `;

    // Add metadata column
    await sql`
      ALTER TABLE user_transcripts
      ADD COLUMN IF NOT EXISTS metadata JSONB
    `;

    // Backfill source_url for existing YouTube entries
    await sql`
      UPDATE user_transcripts
      SET source_url = 'https://youtube.com/watch?v=' || video_id
      WHERE source_url IS NULL AND content_type = 'youtube'
    `;

    return NextResponse.json({
      success: true,
      message: 'Content type columns added successfully'
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Migration failed' },
      { status: 500 }
    );
  }
}
