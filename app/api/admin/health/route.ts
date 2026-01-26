import { NextRequest, NextResponse } from 'next/server';
import { hasValidAdminKey } from '@/lib/admin';
import { sql } from '@/lib/db';

interface HealthCheck {
  name: string;
  status: 'ok' | 'warning' | 'error';
  message: string;
}

/**
 * Health check endpoint for monitoring system status.
 */
export async function GET(request: NextRequest) {
  if (!hasValidAdminKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const checks: HealthCheck[] = [];
  let overallStatus: 'ok' | 'warning' | 'error' = 'ok';

  try {
    // Check 1: Database connection
    try {
      await sql`SELECT 1`;
      checks.push({
        name: 'database',
        status: 'ok',
        message: 'Connected',
      });
    } catch (error) {
      checks.push({
        name: 'database',
        status: 'error',
        message: error instanceof Error ? error.message : 'Connection failed',
      });
      overallStatus = 'error';
    }

    // Check 2: Transcripts count
    try {
      const transcriptResult = await sql`
        SELECT COUNT(*) as count FROM user_transcripts
      `;
      const rowCount = parseInt(transcriptResult.rows[0]?.count || '0', 10);
      checks.push({
        name: 'transcripts',
        status: 'ok',
        message: `${rowCount.toLocaleString()} transcripts stored`,
      });
    } catch {
      checks.push({
        name: 'transcripts',
        status: 'warning',
        message: 'Could not check - table may not exist',
      });
    }

    return NextResponse.json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks,
    });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Health check failed',
      checks,
    }, { status: 500 });
  }
}
