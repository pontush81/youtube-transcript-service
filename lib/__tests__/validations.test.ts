import { describe, it, expect } from 'vitest';
import { isValidBlobUrl } from '../validations';

describe('isValidBlobUrl', () => {
  it('accepts valid Vercel blob URLs', () => {
    expect(isValidBlobUrl('https://blob.vercel-storage.com/transcripts/abc.md')).toBe(true);
    expect(isValidBlobUrl('https://public.blob.vercel-storage.com/transcripts/abc.md')).toBe(true);
  });

  it('accepts subdomains of trusted domains', () => {
    expect(isValidBlobUrl('https://xyz.blob.vercel-storage.com/test.md')).toBe(true);
  });

  it('rejects HTTP (non-HTTPS)', () => {
    expect(isValidBlobUrl('http://blob.vercel-storage.com/test.md')).toBe(false);
  });

  it('rejects untrusted domains', () => {
    expect(isValidBlobUrl('https://evil.com/test.md')).toBe(false);
    expect(isValidBlobUrl('https://example.com/blob.vercel-storage.com')).toBe(false);
  });

  it('rejects malformed URLs', () => {
    expect(isValidBlobUrl('not-a-url')).toBe(false);
    expect(isValidBlobUrl('')).toBe(false);
  });

  it('rejects SSRF attempts', () => {
    expect(isValidBlobUrl('https://169.254.169.254/metadata')).toBe(false);
    expect(isValidBlobUrl('https://localhost/test')).toBe(false);
    expect(isValidBlobUrl('https://127.0.0.1/test')).toBe(false);
  });
});
