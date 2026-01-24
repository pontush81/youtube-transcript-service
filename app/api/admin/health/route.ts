import { NextRequest, NextResponse } from 'next/server';
import { hasValidAdminKey } from '@/lib/admin';
import { sql } from '@/lib/db';

interface HealthCheck {
  name: string;
  status: 'ok' | 'warning' | 'error';
  message: string;
  lastRun?: string;
}

/**
 * Health check endpoint for monitoring system status.
 * Checks if scheduled jobs are running properly.
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

    // Check 2: Cleanup cron job
    try {
      const cleanupResult = await sql`
        SELECT created_at, event_data
        FROM system_logs
        WHERE event_type = 'cleanup_usage'
        ORDER BY created_at DESC
        LIMIT 1
      `;

      if (cleanupResult.rows.length === 0) {
        checks.push({
          name: 'cleanup_cron',
          status: 'warning',
          message: 'Never run - this is OK if system is new',
        });
        // Don't change overallStatus for new systems
      } else {
        const lastRun = new Date(cleanupResult.rows[0].created_at);
        const daysSinceRun = (Date.now() - lastRun.getTime()) / (1000 * 60 * 60 * 24);

        if (daysSinceRun > 35) {
          checks.push({
            name: 'cleanup_cron',
            status: 'warning',
            message: `Last run ${Math.floor(daysSinceRun)} days ago - should run monthly`,
            lastRun: lastRun.toISOString(),
          });
          if (overallStatus === 'ok') overallStatus = 'warning';
        } else {
          checks.push({
            name: 'cleanup_cron',
            status: 'ok',
            message: `Last run ${Math.floor(daysSinceRun)} days ago`,
            lastRun: lastRun.toISOString(),
          });
        }
      }
    } catch {
      checks.push({
        name: 'cleanup_cron',
        status: 'warning',
        message: 'Could not check - system_logs table may not exist',
      });
    }

    // Check 3: Recent cleanup errors
    try {
      const errorResult = await sql`
        SELECT created_at, event_data
        FROM system_logs
        WHERE event_type = 'cleanup_usage_error'
          AND created_at > NOW() - INTERVAL '7 days'
        ORDER BY created_at DESC
        LIMIT 5
      `;

      if (errorResult.rows.length > 0) {
        checks.push({
          name: 'cleanup_errors',
          status: 'warning',
          message: `${errorResult.rows.length} errors in last 7 days`,
        });
        if (overallStatus === 'ok') overallStatus = 'warning';
      } else {
        checks.push({
          name: 'cleanup_errors',
          status: 'ok',
          message: 'No recent errors',
        });
      }
    } catch {
      // Ignore if table doesn't exist
    }

    // Check 4: Usage table size
    try {
      const sizeResult = await sql`
        SELECT COUNT(*) as count FROM usage
      `;
      const rowCount = parseInt(sizeResult.rows[0]?.count || '0', 10);

      if (rowCount > 1000000) {
        checks.push({
          name: 'usage_table_size',
          status: 'warning',
          message: `${rowCount.toLocaleString()} rows - consider running cleanup`,
        });
        if (overallStatus === 'ok') overallStatus = 'warning';
      } else {
        checks.push({
          name: 'usage_table_size',
          status: 'ok',
          message: `${rowCount.toLocaleString()} rows`,
        });
      }
    } catch {
      // Ignore if table doesn't exist
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
