import { NextRequest, NextResponse } from 'next/server';
import { hasValidAdminKey } from '@/lib/admin';
import { sql } from '@/lib/db';

export async function POST(request: NextRequest) {
  if (!hasValidAdminKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS daily_usage (
        user_id TEXT NOT NULL,
        feature TEXT NOT NULL,
        date DATE NOT NULL DEFAULT CURRENT_DATE,
        count INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (user_id, feature, date)
      )
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS daily_usage_date_idx ON daily_usage (date)
    `;

    return NextResponse.json({ success: true, message: 'daily_usage table created' });
  } catch (error) {
    console.error('Usage migration error:', error);
    return NextResponse.json({ success: false, error: 'Migration failed' }, { status: 500 });
  }
}
