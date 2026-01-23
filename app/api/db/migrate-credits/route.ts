import { NextRequest, NextResponse } from 'next/server';
import { hasValidAdminKey } from '@/lib/admin';
import { sql } from '@/lib/db';

export async function POST(request: NextRequest) {
  if (!hasValidAdminKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Create user_credits table
    await sql`
      CREATE TABLE IF NOT EXISTS user_credits (
        user_id TEXT PRIMARY KEY,
        balance INTEGER DEFAULT 20,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // Create index for quick balance checks
    await sql`
      CREATE INDEX IF NOT EXISTS user_credits_balance_idx
      ON user_credits (balance)
      WHERE balance > 0
    `;

    // Give existing users 20 credits
    await sql`
      INSERT INTO user_credits (user_id, balance)
      SELECT DISTINCT user_id::TEXT, 20
      FROM user_transcripts
      WHERE user_id IS NOT NULL
      ON CONFLICT (user_id) DO NOTHING
    `;

    return NextResponse.json({
      success: true,
      message: 'Credits table created and existing users credited'
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Migration failed' },
      { status: 500 }
    );
  }
}
