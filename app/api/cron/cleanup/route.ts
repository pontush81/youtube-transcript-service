import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

/**
 * Cron endpoint for monthly usage cleanup.
 * Called by Vercel Cron - secured by CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sets this automatically for cron jobs)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - 3);
    const cutoffISO = cutoffDate.toISOString();

    // Count rows to be processed
    const countResult = await sql`
      SELECT COUNT(*) as count FROM usage
      WHERE created_at < ${cutoffISO}
    `;
    const rowsToProcess = parseInt(countResult.rows[0]?.count || '0', 10);

    let aggregated = 0;
    let deleted = 0;

    if (rowsToProcess > 0) {
      // Aggregate into monthly summaries
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
      aggregated = aggregateResult.rows.length;

      // Delete old detail rows
      const deleteResult = await sql`
        DELETE FROM usage
        WHERE created_at < ${cutoffISO}
      `;
      deleted = deleteResult.rowCount || 0;
    }

    // Log the cron run
    await sql`
      INSERT INTO system_logs (event_type, event_data, created_at)
      VALUES (
        'cleanup_usage',
        ${JSON.stringify({ aggregated, deleted, cutoffDate: cutoffISO })}::jsonb,
        NOW()
      )
    `;

    console.log(`Cron cleanup: aggregated ${aggregated}, deleted ${deleted}`);

    return NextResponse.json({
      success: true,
      aggregated,
      deleted,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    // Log the error
    try {
      await sql`
        INSERT INTO system_logs (event_type, event_data, created_at)
        VALUES (
          'cleanup_usage_error',
          ${JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' })}::jsonb,
          NOW()
        )
      `;
    } catch {
      // Ignore logging errors
    }

    console.error('Cron cleanup error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Cleanup failed' },
      { status: 500 }
    );
  }
}
