/**
 * Extract the base YouTube video ID from various formats.
 * YouTube video IDs are always 11 characters.
 *
 * Examples:
 * - "421T2iWTQio" -> "421T2iWTQio"
 * - "421T2iWTQio-1768890127930" -> "421T2iWTQio"
 * - "421T2iWTQio-1768890127930-iFrcB7dXcsgpJnULZGc7OeaGA0DbuC" -> "421T2iWTQio"
 */
export function extractYouTubeVideoId(input: string): string {
  // YouTube video IDs are exactly 11 characters
  // They contain: a-z, A-Z, 0-9, - and _
  const match = input.match(/^([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : input;
}

/**
 * Extract video ID from a blob pathname.
 * Format: transcripts/{videoId}-{timestamp}.md
 */
export function extractVideoIdFromBlobPath(pathname: string): string {
  const filename = pathname.replace('transcripts/', '').replace('.md', '');
  // The first 11 characters should be the YouTube video ID
  return extractYouTubeVideoId(filename);
}
