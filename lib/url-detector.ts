export type ContentType = 'youtube' | 'web';

const YOUTUBE_PATTERNS = [
  /^https?:\/\/(www\.)?youtube\.com\/watch\?v=/,
  /^https?:\/\/youtu\.be\//,
  /^https?:\/\/(www\.)?youtube\.com\/embed\//,
  /^https?:\/\/(www\.)?youtube\.com\/v\//,
  /^https?:\/\/(www\.)?youtube\.com\/shorts\//,
];

/**
 * Detect if a URL is YouTube or a regular web page.
 */
export function detectContentType(url: string): ContentType {
  const normalizedUrl = url.trim().toLowerCase();

  for (const pattern of YOUTUBE_PATTERNS) {
    if (pattern.test(normalizedUrl)) {
      return 'youtube';
    }
  }

  return 'web';
}

/**
 * Validate that a string is a valid URL.
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Extract domain from URL for metadata.
 */
export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return 'unknown';
  }
}
