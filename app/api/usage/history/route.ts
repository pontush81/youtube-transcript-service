import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { sql } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const days = Math.min(parseInt(request.nextUrl.searchParams.get('days') || '30', 10), 90);

  const result = await sql`
    SELECT feature, date, count
    FROM daily_usage
    WHERE user_id = ${userId}
      AND date >= CURRENT_DATE - ${days}::int
    ORDER BY date DESC, feature
  `;

  // Group by date
  const byDate = new Map<string, { summary: number; chat: number }>();
  for (const row of result.rows) {
    const dateStr = new Date(row.date).toISOString().split('T')[0];
    const entry = byDate.get(dateStr) || { summary: 0, chat: 0 };
    if (row.feature === 'summary') entry.summary = row.count;
    if (row.feature === 'chat') entry.chat = row.count;
    byDate.set(dateStr, entry);
  }

  const history = Array.from(byDate.entries()).map(([date, usage]) => ({
    date,
    summary: usage.summary,
    chat: usage.chat,
  }));

  // Totals
  const totals = history.reduce(
    (acc, day) => ({
      summary: acc.summary + day.summary,
      chat: acc.chat + day.chat,
    }),
    { summary: 0, chat: 0 }
  );

  return NextResponse.json({ history, totals, days });
}
