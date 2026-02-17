import { z } from 'zod';

// YouTube URL/ID validation
const YOUTUBE_URL_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|v\/)|youtu\.be\/)[\w-]{11}([?&].*)?$/;
const YOUTUBE_ID_REGEX = /^[\w-]{11}$/;

// Trusted blob storage domains (SSRF protection)
const TRUSTED_BLOB_DOMAINS = [
  'blob.vercel-storage.com',
  'public.blob.vercel-storage.com',
];

/**
 * Validate that a URL is from a trusted blob storage domain.
 * Prevents SSRF attacks by ensuring we only fetch from expected sources.
 */
export function isValidBlobUrl(url: string): boolean {
  try {
    const parsed = new URL(url);

    // Must be HTTPS
    if (parsed.protocol !== 'https:') {
      return false;
    }

    // Must be from trusted domain
    const hostname = parsed.hostname.toLowerCase();
    return TRUSTED_BLOB_DOMAINS.some(
      domain => hostname === domain || hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

// Custom Zod validator for blob URLs with SSRF protection
const blobUrlSchema = z.string().url('Invalid URL').refine(
  (url) => isValidBlobUrl(url),
  { message: 'URL must be from a trusted source' }
);

export const youtubeUrlSchema = z.string().regex(YOUTUBE_URL_REGEX, 'Invalid YouTube URL');
export const videoIdSchema = z.string().regex(YOUTUBE_ID_REGEX, 'Invalid video ID');

// Transcript submission
export const transcriptSubmitSchema = z.object({
  url: youtubeUrlSchema,
  submitter: z.string().max(100).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  notes: z.string().max(1000).optional(),
});

// Chat message
export const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(10000),
});

// Chat request
export const chatRequestSchema = z.object({
  message: z.string().min(1, 'Message required').max(10000),
  conversationHistory: z.array(chatMessageSchema).max(50).default([]),
  selectedVideos: z.union([
    z.literal('all'),
    z.array(videoIdSchema).min(1, 'Select at least one video').max(100),
  ]),
  mode: z.enum(['strict', 'hybrid']).default('strict'),
});

// Delete request (uses SSRF-protected blob URL validation)
export const deleteRequestSchema = z.object({
  blobUrl: blobUrlSchema,
  adminKey: z.string().min(1, 'Admin key required'),
});

// Embedding backfill
export const backfillRequestSchema = z.object({
  adminKey: z.string().min(1, 'Admin key required'),
  videoId: videoIdSchema.optional(),
  force: z.boolean().default(false),
});

// Format request (uses SSRF-protected blob URL validation)
export const formatRequestSchema = z.object({
  blobUrl: blobUrlSchema,
  title: z.string().max(500).optional(),
});

// Helper to safely parse and return error response
export function parseRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  // Zod 4 uses .issues instead of .errors
  const firstIssue = result.error.issues[0];
  return {
    success: false,
    error: firstIssue?.message || 'Invalid data',
  };
}
