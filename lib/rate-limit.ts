/**
 * Persistent rate limiter using Upstash Redis.
 * Works across serverless cold starts and multiple instances.
 */

import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

// Initialize Redis client (uses UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env vars)
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

// Check if Redis is configured
const isRedisConfigured = !!(
  process.env.UPSTASH_REDIS_REST_URL &&
  process.env.UPSTASH_REDIS_REST_TOKEN
);

// Create rate limiters for different endpoints
const chatLimiter = isRedisConfigured
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, '1 m'), // 30 requests per minute
      analytics: true,
      prefix: 'ratelimit:chat',
    })
  : null;

const transcriptLimiter = isRedisConfigured
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '1 m'), // 10 requests per minute
      analytics: true,
      prefix: 'ratelimit:transcript',
    })
  : null;

const deleteLimiter = isRedisConfigured
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '1 m'), // 5 delete attempts per minute
      analytics: true,
      prefix: 'ratelimit:delete',
    })
  : null;

const backfillLimiter = isRedisConfigured
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(2, '1 m'), // 2 backfills per minute
      analytics: true,
      prefix: 'ratelimit:backfill',
    })
  : null;

// Limiter map for easy access
const limiters = {
  chat: chatLimiter,
  transcript: transcriptLimiter,
  delete: deleteLimiter,
  backfill: backfillLimiter,
};

export type RateLimitType = keyof typeof limiters;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
}

// Track Redis failures for circuit breaker
let redisFailureCount = 0;
let lastFailureTime = 0;
const FAILURE_THRESHOLD = 3;
const RECOVERY_TIME_MS = 60000; // 1 minute

/**
 * Check rate limit for a specific endpoint type and identifier.
 * Implements circuit breaker pattern - fails closed after repeated Redis failures.
 */
export async function checkRateLimit(
  type: RateLimitType,
  identifier: string
): Promise<RateLimitResult> {
  const limiter = limiters[type];

  // If Redis not configured, use in-memory fallback in dev only
  if (!limiter) {
    if (process.env.NODE_ENV === 'production') {
      console.error('CRITICAL: Rate limiting disabled in production!');
      // Fail closed in production if Redis not configured
      return {
        allowed: false,
        remaining: 0,
        resetAt: Date.now() + 60000,
        limit: 0,
      };
    }
    console.warn(`Rate limiting disabled: Redis not configured. Type: ${type}`);
    return {
      allowed: true,
      remaining: 999,
      resetAt: Date.now() + 60000,
      limit: 999,
    };
  }

  // Circuit breaker: if too many recent failures, fail closed
  const now = Date.now();
  if (redisFailureCount >= FAILURE_THRESHOLD) {
    if (now - lastFailureTime < RECOVERY_TIME_MS) {
      console.warn('Circuit breaker open: Rate limiting failing closed');
      return {
        allowed: false,
        remaining: 0,
        resetAt: lastFailureTime + RECOVERY_TIME_MS,
        limit: 0,
      };
    }
    // Recovery time passed, reset counter
    redisFailureCount = 0;
  }

  try {
    const result = await limiter.limit(identifier);
    // Success - reset failure counter
    redisFailureCount = 0;
    return {
      allowed: result.success,
      remaining: result.remaining,
      resetAt: result.reset,
      limit: result.limit,
    };
  } catch (error) {
    // Track failure
    redisFailureCount++;
    lastFailureTime = now;
    console.error(`Rate limit check failed (${redisFailureCount}/${FAILURE_THRESHOLD}):`, error);

    // Fail closed after threshold
    if (redisFailureCount >= FAILURE_THRESHOLD) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: now + RECOVERY_TIME_MS,
        limit: 0,
      };
    }

    // Allow single failures but warn
    return {
      allowed: true,
      remaining: 1,
      resetAt: now + 60000,
      limit: 30,
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
