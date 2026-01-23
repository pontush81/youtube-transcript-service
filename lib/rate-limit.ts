/**
 * Simple in-memory rate limiter for serverless environments.
 * Note: This resets on cold starts. For production, use Redis/Upstash.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up old entries periodically to prevent memory leaks
const CLEANUP_INTERVAL = 60000; // 1 minute
let lastCleanup = Date.now();

function cleanupOldEntries() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;

  lastCleanup = now;
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < now) {
      store.delete(key);
    }
  }
}

interface RateLimitConfig {
  maxRequests: number;  // Max requests per window
  windowMs: number;     // Time window in milliseconds
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  cleanupOldEntries();

  const now = Date.now();
  const entry = store.get(identifier);

  // No entry or expired - create new window
  if (!entry || entry.resetAt < now) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetAt: now + config.windowMs,
    };
    store.set(identifier, newEntry);
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt: newEntry.resetAt,
    };
  }

  // Within window - check limit
  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
    };
  }

  // Increment and allow
  entry.count++;
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt,
  };
}

// Predefined limits for different endpoints
export const RATE_LIMITS = {
  chat: { maxRequests: 30, windowMs: 60000 },       // 30 requests per minute
  transcript: { maxRequests: 10, windowMs: 60000 }, // 10 transcripts per minute
  backfill: { maxRequests: 2, windowMs: 60000 },    // 2 backfills per minute
};

// Helper to get client identifier from request
export function getClientIdentifier(request: Request): string {
  // Try various headers for real IP
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfIp = request.headers.get('cf-connecting-ip');

  // Use first IP from forwarded chain, or fallback
  const ip = forwarded?.split(',')[0]?.trim() || realIp || cfIp || 'anonymous';
  return ip;
}
