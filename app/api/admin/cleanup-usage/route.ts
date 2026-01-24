import { NextRequest, NextResponse } from 'next/server';
import { hasValidAdminKey } from '@/lib/admin';
import { sql } from '@/lib/db';

/**
 * Cleanup old usage data:
 * 1. Aggregate data older than 3 months into usage_monthly
 * 2. Delete the detail rows
 *
 * Run this monthly via cron or manually.
 */
export async function POST(request: NextRequest) {
  if (!hasValidAdminKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - 3);
    const cutoffISO = cutoffDate.toISOString();

    // Step 1: Count rows to be processed
    const countResult = await sql`
      SELECT COUNT(*) as count FROM usage
      WHERE created_at < ${cutoffISO}
    `;
    const rowsToProcess = parseInt(countResult.rows[0]?.count || '0', 10);

    if (rowsToProcess === 0) {
      return NextResponse.json({
        success: true,
        message: 'No old data to clean up',
        aggregated: 0,
        deleted: 0,
      });
    }

    // Step 2: Aggregate into monthly summaries
    // Use UPSERT to handle running multiple times safely
    const aggregateResult = await sql`
      INSERT INTO usage_monthly (user_id, month, chats, transcripts, created_at)
      SELECT
        user_id,
        date_trunc('month', created_at)::date as month,
        COUNT(*) FILTER (WHERE usage_type = 'chat') as chats,
        COUNT(*) FILTER (WHERE usage_type = 'transcript') as transcripts,
        NOW()
      FROM usage
      WHERE created_at < ${cutoffISO}
      GROUP BY user_id, date_trunc('month', created_at)
      ON CONFLICT (user_id, month)
      DO UPDATE SET
        chats = usage_monthly.chats + EXCLUDED.chats,
        transcripts = usage_monthly.transcripts + EXCLUDED.transcripts
      RETURNING id
    `;
    const aggregatedRows = aggregateResult.rows.length;

    // Step 3: Delete the old detail rows
    const deleteResult = await sql`
      DELETE FROM usage
      WHERE created_at < ${cutoffISO}
    `;
    const deletedRows = deleteResult.rowCount || 0;

    // Step 4: Log the cleanup
    console.log(`Usage cleanup: aggregated ${aggregatedRows} monthly summaries, deleted ${deletedRows} detail rows`);

    return NextResponse.json({
      success: true,
      message: `Cleaned up usage data older than ${cutoffDate.toISOString().split('T')[0]}`,
      aggregated: aggregatedRows,
      deleted: deletedRows,
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Cleanup failed' },
      { status: 500 }
    );
  }
}

/**
 * GET: Preview what would be cleaned up (dry run)
 */
export async function GET(request: NextRequest) {
  if (!hasValidAdminKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - 3);
    const cutoffISO = cutoffDate.toISOString();

    // Preview what would be deleted
    const previewResult = await sql`
      SELECT
        COUNT(*) as total_rows,
        COUNT(DISTINCT user_id) as affected_users,
        MIN(created_at) as oldest_row,
        MAX(created_at) as newest_row
      FROM usage
      WHERE created_at < ${cutoffISO}
    `;

    const preview = previewResult.rows[0];

    return NextResponse.json({
      dryRun: true,
      cutoffDate: cutoffDate.toISOString().split('T')[0],
      rowsToDelete: parseInt(preview?.total_rows || '0', 10),
      affectedUsers: parseInt(preview?.affected_users || '0', 10),
      oldestRow: preview?.oldest_row,
      newestRow: preview?.newest_row,
      message: 'Use POST to execute cleanup',
    });
  } catch (error) {
    console.error('Cleanup preview error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Preview failed' },
      { status: 500 }
    );
  }
}
