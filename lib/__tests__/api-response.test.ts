import { describe, it, expect } from 'vitest';
import { errorResponse, rateLimitResponse, successResponse } from '../api-response';

describe('errorResponse', () => {
  it('returns correct shape', async () => {
    const res = errorResponse('Something failed', 400);
    const body = await res.json();
    expect(body).toEqual({ success: false, error: 'Something failed' });
    expect(res.status).toBe(400);
  });

  it('supports custom headers', async () => {
    const res = errorResponse('Nope', 403, { 'X-Custom': 'test' });
    expect(res.headers.get('X-Custom')).toBe('test');
  });
});

describe('rateLimitResponse', () => {
  it('returns 429 with rate limit headers', async () => {
    const res = rateLimitResponse({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 30000,
      limit: 10,
    });
    const body = await res.json();
    expect(res.status).toBe(429);
    expect(body.success).toBe(false);
    expect(body.error).toContain('Too many requests');
    expect(res.headers.get('X-RateLimit-Limit')).toBe('10');
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('0');
  });
});

describe('successResponse', () => {
  it('returns correct shape', async () => {
    const res = successResponse({ data: 'hello' });
    const body = await res.json();
    expect(body).toEqual({ success: true, data: 'hello' });
    expect(res.status).toBe(200);
  });

  it('supports custom status', async () => {
    const res = successResponse({ id: '123' }, 201);
    expect(res.status).toBe(201);
  });
});
