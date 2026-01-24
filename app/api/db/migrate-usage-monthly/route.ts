import { NextRequest, NextResponse } from 'next/server';
import { hasValidAdminKey } from '@/lib/admin';
import { sql } from '@/lib/db';

export async function POST(request: NextRequest) {
  if (!hasValidAdminKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Create usage_monthly table for aggregated historical data
    await sql`
      CREATE TABLE IF NOT EXISTS usage_monthly (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        month DATE NOT NULL,
        chats INTEGER NOT NULL DEFAULT 0,
        transcripts INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, month)
      )
    `;

    // Create index for user lookups
    await sql`
      CREATE INDEX IF NOT EXISTS idx_usage_monthly_user
      ON usage_monthly (user_id, month DESC)
    `;

    return NextResponse.json({
      success: true,
      message: 'usage_monthly table created successfully',
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Migration failed' },
      { status: 500 }
    );
  }
}
