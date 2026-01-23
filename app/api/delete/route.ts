import { NextRequest, NextResponse } from 'next/server';
import { del, list } from '@vercel/blob';
import { timingSafeEqual } from 'crypto';
import { z } from 'zod';
import { checkRateLimit, getClientIdentifier, rateLimitHeaders } from '@/lib/rate-limit';
import { auth } from '@clerk/nextjs/server';
import { sql } from '@/lib/db';

// Timing-safe string comparison to prevent timing attacks
function secureCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }

  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  // If lengths differ, compare against itself to maintain constant time
  if (aBuffer.length !== bBuffer.length) {
    timingSafeEqual(aBuffer, aBuffer);
    return false;
  }

  return timingSafeEqual(aBuffer, bBuffer);
}

// Schema for single delete (legacy support)
const singleDeleteSchema = z.object({
  blobUrl: z.string().url(),
  adminKey: z.string().optional(),
});

// Schema for bulk delete
const bulkDeleteSchema = z.object({
  videoIds: z.array(z.string()).min(1).max(50),
  adminKey: z.string().optional(),
});

export async function POST(request: NextRequest) {
  // Rate limiting
  const clientId = getClientIdentifier(request);
  const rateLimit = await checkRateLimit('delete', clientId);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: 'För många försök. Vänta en stund.',
        retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
      },
      { status: 429, headers: rateLimitHeaders(rateLimit) }
    );
  }

  try {
    const { userId } = await auth();
    const rawBody = await request.json();
    const validAdminKey = process.env.ADMIN_KEY;

    // Check if this is a bulk delete or single delete
    const bulkParsed = bulkDeleteSchema.safeParse(rawBody);

    if (bulkParsed.success) {
      // Bulk delete
      const { videoIds, adminKey } = bulkParsed.data;
      const isAdmin = adminKey && validAdminKey && secureCompare(adminKey, validAdminKey);

      if (!userId && !isAdmin) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        );
      }

      // Get user's transcripts if not admin
      const userVideoIds = new Set<string>();
      if (userId && !isAdmin) {
        const userTranscripts = await sql`
          SELECT video_id FROM user_transcripts WHERE user_id = ${userId}
        `;
        userTranscripts.rows.forEach(r => userVideoIds.add(r.video_id));
      }

      const results: Array<{
        videoId: string;
        success: boolean;
        error?: string;
      }> = [];

      // Get all blobs to find URLs for the video IDs
      const { blobs } = await list({ prefix: 'transcripts/' });
      const blobMap = new Map<string, string>();
      for (const blob of blobs) {
        const filename = blob.pathname.replace('transcripts/', '').replace('.md', '');
        // Extract normalized video ID from filename
        const normalizedId = filename.split('_')[0] || filename;
        if (!blobMap.has(normalizedId)) {
          blobMap.set(normalizedId, blob.url);
        }
      }

      for (const videoId of videoIds) {
        // Check permission
        if (!isAdmin && !userVideoIds.has(videoId)) {
          results.push({
            videoId,
            success: false,
            error: 'Ingen behörighet',
          });
          continue;
        }

        // Find blob URL
        const blobUrl = blobMap.get(videoId);
        if (!blobUrl) {
          results.push({
            videoId,
            success: false,
            error: 'Hittades inte',
          });
          continue;
        }

        try {
          // Delete from Vercel Blob
          await del(blobUrl);

          // Delete from database tables
          await sql`DELETE FROM user_transcripts WHERE video_id = ${videoId}`;
          await sql`DELETE FROM transcript_chunks WHERE video_id = ${videoId}`;

          results.push({ videoId, success: true });
        } catch (err) {
          console.error(`Delete error for ${videoId}:`, err);
          results.push({
            videoId,
            success: false,
            error: 'Kunde inte radera',
          });
        }
      }

      const successful = results.filter(r => r.success).length;
      return NextResponse.json({
        success: true,
        message: `${successful} av ${videoIds.length} transkript raderade`,
        results,
        summary: {
          successful,
          failed: results.filter(r => !r.success).length,
          total: videoIds.length,
        },
      });
    }

    // Single delete (legacy)
    const singleParsed = singleDeleteSchema.safeParse(rawBody);
    if (!singleParsed.success) {
      return NextResponse.json(
        { success: false, error: 'Ogiltiga parametrar' },
        { status: 400 }
      );
    }

    const { blobUrl, adminKey } = singleParsed.data;
    const isAdmin = adminKey && validAdminKey && secureCompare(adminKey, validAdminKey);

    // Extract video ID from blob URL
    const urlParts = blobUrl.split('/');
    const filename = urlParts[urlParts.length - 1]?.replace('.md', '') || '';
    const videoId = filename.split('_')[0] || filename;

    // Check if user owns this transcript
    let isOwner = false;
    if (userId) {
      const ownerCheck = await sql`
        SELECT 1 FROM user_transcripts WHERE user_id = ${userId} AND video_id = ${videoId}
      `;
      isOwner = ownerCheck.rows.length > 0;
    }

    if (!isAdmin && !isOwner) {
      return NextResponse.json(
        { success: false, error: isOwner === false && userId ? 'Du kan bara radera dina egna transkript' : 'Ogiltig admin-nyckel' },
        { status: 401 }
      );
    }

    // Delete from Vercel Blob
    await del(blobUrl);

    // Delete from database
    await sql`DELETE FROM user_transcripts WHERE video_id = ${videoId}`;
    await sql`DELETE FROM transcript_chunks WHERE video_id = ${videoId}`;

    return NextResponse.json({
      success: true,
      message: 'Transkriptet har raderats',
    });
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json(
      { success: false, error: 'Kunde inte radera transkriptet' },
      { status: 500 }
    );
  }
}
