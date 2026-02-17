import { sql } from '@/lib/db';

const LIMITS = {
  free: { summary: 3, chat: 10 },
  pro: { summary: Infinity, chat: Infinity },
} as const;

export type Plan = keyof typeof LIMITS;
export type Feature = 'summary' | 'chat';

export async function checkUsage(
  userId: string | null,
  feature: Feature,
  plan: Plan = 'free'
): Promise<{ allowed: boolean; used: number; limit: number; remaining: number }> {
  const limit = LIMITS[plan][feature];
  if (limit === Infinity) {
    return { allowed: true, used: 0, limit: -1, remaining: -1 };
  }

  const effectiveUserId = userId || 'anon';

  try {
    const result = await sql`
      SELECT count FROM daily_usage
      WHERE user_id = ${effectiveUserId}
        AND feature = ${feature}
        AND date = CURRENT_DATE
    `;
    const used = result.rows[0]?.count ?? 0;
    return {
      allowed: used < limit,
      used,
      limit,
      remaining: Math.max(0, limit - used),
    };
  } catch {
    // If DB query fails, allow the request (fail open)
    return { allowed: true, used: 0, limit, remaining: limit };
  }
}

export async function incrementUsage(
  userId: string | null,
  feature: Feature
): Promise<void> {
  const effectiveUserId = userId || 'anon';
  try {
    await sql`
      INSERT INTO daily_usage (user_id, feature, date, count)
      VALUES (${effectiveUserId}, ${feature}, CURRENT_DATE, 1)
      ON CONFLICT (user_id, feature, date)
      DO UPDATE SET count = daily_usage.count + 1
    `;
  } catch {
    // Non-critical -- don't fail the request
  }
}

export function getUserPlan(publicMetadata: Record<string, unknown> | null): Plan {
  if (!publicMetadata) return 'free';
  return publicMetadata.plan === 'pro' ? 'pro' : 'free';
}
