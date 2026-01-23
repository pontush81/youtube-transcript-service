import { z } from 'zod';

// YouTube URL/ID validation
const YOUTUBE_URL_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|v\/)|youtu\.be\/)[\w-]{11}/;
const YOUTUBE_ID_REGEX = /^[\w-]{11}$/;

export const youtubeUrlSchema = z.string().regex(YOUTUBE_URL_REGEX, 'Ogiltig YouTube URL');
export const videoIdSchema = z.string().regex(YOUTUBE_ID_REGEX, 'Ogiltigt video-ID');

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
  message: z.string().min(1, 'Meddelande krävs').max(10000),
  conversationHistory: z.array(chatMessageSchema).max(50).default([]),
  selectedVideos: z.union([
    z.literal('all'),
    z.array(videoIdSchema).min(1, 'Välj minst en video').max(100),
  ]),
  mode: z.enum(['strict', 'hybrid']).default('strict'),
});

// Delete request
export const deleteRequestSchema = z.object({
  blobUrl: z.string().url('Ogiltig blob URL'),
  adminKey: z.string().min(1, 'Admin-nyckel krävs'),
});

// Embedding backfill
export const backfillRequestSchema = z.object({
  adminKey: z.string().min(1, 'Admin-nyckel krävs'),
  videoId: videoIdSchema.optional(),
  force: z.boolean().default(false),
});

// Format request (for formatting existing blob)
export const formatRequestSchema = z.object({
  blobUrl: z.string().url('Ogiltig blob URL'),
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
    error: firstIssue?.message || 'Ogiltig data',
  };
}
