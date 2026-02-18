/**
 * Rate limiter using PostgreSQL.
 * Fixed-window approach: counts requests per identifier per minute.
 * Automatically cleans up old entries.
 */

import { sql } from '@/lib/db';
import { logger } from '@/lib/logger';

// Rate limits per endpoint (requests per minute)
const LIMITS: Record<string, number> = {
  chat: 30,
  transcript: 10,
  delete: 5,
  backfill: 2,
  summary: 5,
};

const WINDOW_SIZE_MS = 60_000; // 1 minute

export type RateLimitType = keyof typeof LIMITS;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
}

/**
 * Check rate limit for a specific endpoint type and identifier.
 * Uses PostgreSQL with fixed-window counting.
 */
export async function checkRateLimit(
  type: RateLimitType,
  identifier: string
): Promise<RateLimitResult> {
  const limit = LIMITS[type] ?? 10;
  const now = Date.now();
  const windowStart = Math.floor(now / WINDOW_SIZE_MS) * WINDOW_SIZE_MS;
  const resetAt = windowStart + WINDOW_SIZE_MS;

  try {
    // Upsert: increment counter for current window, return new count
    const result = await sql`
      INSERT INTO rate_limits (identifier, endpoint, window_start, request_count)
      VALUES (${identifier}, ${type}, ${windowStart}, 1)
      ON CONFLICT (identifier, endpoint, window_start)
      DO UPDATE SET request_count = rate_limits.request_count + 1
      RETURNING request_count
    `;

    const count = result.rows[0]?.request_count ?? 1;
    const allowed = count <= limit;
    const remaining = Math.max(0, limit - count);

    // Periodically clean up old entries (1% chance per request to avoid overhead)
    if (Math.random() < 0.01) {
      const cutoff = now - WINDOW_SIZE_MS * 5; // Keep last 5 minutes
      sql`DELETE FROM rate_limits WHERE window_start < ${cutoff}`.catch(() => {});
    }

    return { allowed, remaining, resetAt, limit };
  } catch (error) {
    // If DB fails, fail closed to prevent abuse
    logger.error('Rate limit check failed', { error: error instanceof Error ? error.message : String(error) });
    return {
      allowed: false,
      remaining: 0,
      resetAt: now + WINDOW_SIZE_MS,
      limit: 0,
    };
  }
}

/**
 * Get client identifier from request headers.
 * Validates IP format to prevent header spoofing.
 */
export function getClientIdentifier(request: Request): string {
  // Vercel-specific header (most reliable on Vercel)
  const vercelIp = request.headers.get('x-vercel-forwarded-for');

  // Cloudflare header
  const cfIp = request.headers.get('cf-connecting-ip');

  // Standard forwarded header (take first IP only)
  const forwarded = request.headers.get('x-forwarded-for');
  const forwardedIp = forwarded?.split(',')[0]?.trim();

  // Real IP header
  const realIp = request.headers.get('x-real-ip');

  // Use most reliable source available
  const ip = vercelIp || cfIp || forwardedIp || realIp || 'anonymous';

  // Basic IP format validation (IPv4 or IPv6)
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;

  if (ipv4Regex.test(ip) || ipv6Regex.test(ip) || ip === 'anonymous') {
    return ip;
  }

  // If IP doesn't match expected format, use hash to prevent injection
  return `invalid-${ip.slice(0, 32).replace(/[^a-zA-Z0-9]/g, '')}`;
}

/**
 * Create rate limit response headers
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(result.resetAt),
  };
}
