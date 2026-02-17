import { Redis } from '@upstash/redis';

const isRedisConfigured = !!(
  process.env.UPSTASH_REDIS_REST_URL &&
  process.env.UPSTASH_REDIS_REST_TOKEN
);

const redis = isRedisConfigured ? Redis.fromEnv() : null;

const LIMITS = {
  free: { summary: 3, chat: 10 },
  pro: { summary: Infinity, chat: Infinity },
} as const;

export type Plan = keyof typeof LIMITS;
export type Feature = 'summary' | 'chat';

function dailyKey(userId: string, feature: Feature): string {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return `usage:${feature}:${userId}:${date}`;
}

export async function checkUsage(
  userId: string | null,
  feature: Feature,
  plan: Plan = 'free'
): Promise<{ allowed: boolean; used: number; limit: number; remaining: number }> {
  const limit = LIMITS[plan][feature];
  if (limit === Infinity) {
    return { allowed: true, used: 0, limit: -1, remaining: -1 };
  }

  // Anonymous users (no auth) share a single pool -- incentive to sign in
  const key = dailyKey(userId || 'anon', feature);

  if (!redis) return { allowed: true, used: 0, limit, remaining: limit };

  try {
    const used = (await redis.get<number>(key)) || 0;
    return {
      allowed: used < limit,
      used,
      limit,
      remaining: Math.max(0, limit - used),
    };
  } catch {
    // If Redis fails, allow the request (fail open)
    return { allowed: true, used: 0, limit, remaining: limit };
  }
}

export async function incrementUsage(
  userId: string | null,
  feature: Feature
): Promise<void> {
  if (!redis) return;
  const key = dailyKey(userId || 'anon', feature);
  try {
    const pipeline = redis.pipeline();
    pipeline.incr(key);
    pipeline.expire(key, 86400); // 24h TTL
    await pipeline.exec();
  } catch {
    // Non-critical -- don't fail the request
  }
}

export function getUserPlan(publicMetadata: Record<string, unknown> | null): Plan {
  if (!publicMetadata) return 'free';
  return publicMetadata.plan === 'pro' ? 'pro' : 'free';
}
