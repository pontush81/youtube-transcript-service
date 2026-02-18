import { NextRequest, NextResponse } from 'next/server';
import { hasValidAdminKey } from '@/lib/admin';
import { sql } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  if (!hasValidAdminKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Create system_logs table for tracking cron jobs and system events
    await sql`
      CREATE TABLE IF NOT EXISTS system_logs (
        id SERIAL PRIMARY KEY,
        event_type TEXT NOT NULL,
        event_data JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Create index for event lookups
    await sql`
      CREATE INDEX IF NOT EXISTS idx_system_logs_type_date
      ON system_logs (event_type, created_at DESC)
    `;

    return NextResponse.json({
      success: true,
      message: 'system_logs table created successfully',
    });
  } catch (error) {
    logger.error('Migration error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Migration failed' },
      { status: 500 }
    );
  }
}
