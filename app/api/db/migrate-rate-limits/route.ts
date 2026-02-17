import { NextRequest, NextResponse } from 'next/server';
import { hasValidAdminKey } from '@/lib/admin';
import { sql } from '@/lib/db';

export async function POST(request: NextRequest) {
  if (!hasValidAdminKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS rate_limits (
        identifier TEXT NOT NULL,
        endpoint TEXT NOT NULL,
        window_start BIGINT NOT NULL,
        request_count INTEGER DEFAULT 1,
        PRIMARY KEY (identifier, endpoint, window_start)
      )
    `;

    return NextResponse.json({
      success: true,
      message: 'rate_limits table created successfully',
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Migration failed' },
      { status: 500 }
    );
  }
}
