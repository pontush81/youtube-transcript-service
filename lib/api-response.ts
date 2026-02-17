import { NextResponse } from 'next/server';
import { RateLimitResult, rateLimitHeaders } from '@/lib/rate-limit';

/**
 * Standardized API error response.
 * All error responses use the same shape: { success: false, error: string }
 */
export function errorResponse(
  error: string,
  status: number,
  headers?: Record<string, string>
) {
  return NextResponse.json(
    { success: false, error },
    { status, headers }
  );
}

/**
 * Standardized rate limit exceeded response (429).
 */
export function rateLimitResponse(rateLimit: RateLimitResult) {
  return errorResponse(
    'Too many requests. Please wait.',
    429,
    {
      ...rateLimitHeaders(rateLimit),
      'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
    }
  );
}

/**
 * Standardized success response.
 */
export function successResponse<T extends Record<string, unknown>>(
  data: T,
  status = 200,
  headers?: Record<string, string>
) {
  return NextResponse.json(
    { success: true, ...data },
    { status, headers }
  );
}
