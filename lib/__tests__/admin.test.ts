import { describe, it, expect } from 'vitest';
import { secureCompare } from '../admin';

describe('secureCompare', () => {
  it('returns true for identical strings', () => {
    expect(secureCompare('abc123', 'abc123')).toBe(true);
  });

  it('returns false for different strings', () => {
    expect(secureCompare('abc123', 'xyz789')).toBe(false);
  });

  it('returns false for different lengths', () => {
    expect(secureCompare('short', 'much-longer-string')).toBe(false);
  });

  it('returns false for empty vs non-empty', () => {
    expect(secureCompare('', 'something')).toBe(false);
  });

  it('returns true for both empty', () => {
    expect(secureCompare('', '')).toBe(true);
  });

  it('returns false for non-string inputs', () => {
    // @ts-expect-error testing runtime safety
    expect(secureCompare(null, 'test')).toBe(false);
    // @ts-expect-error testing runtime safety
    expect(secureCompare('test', undefined)).toBe(false);
    // @ts-expect-error testing runtime safety
    expect(secureCompare(123, 456)).toBe(false);
  });

  it('handles special characters', () => {
    const key = 'sk_test_abc123!@#$%^&*()';
    expect(secureCompare(key, key)).toBe(true);
    expect(secureCompare(key, key + ' ')).toBe(false);
  });
});
