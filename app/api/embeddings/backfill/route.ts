import { NextResponse } from 'next/server';
import { list } from '@vercel/blob';
import { sql } from '@/lib/db';
import { saveTranscriptEmbeddings } from '@/lib/embeddings';
import { extractYouTubeVideoId } from '@/lib/video-utils';

export async function POST(request: Request) {
  try {
    // Check for clean parameter to wipe and rebuild
    const { searchParams } = new URL(request.url);
    const clean = searchParams.get('clean') === 'true';

    if (clean) {
      // Delete all existing chunks
      await sql`DELETE FROM transcript_chunks`;
    }

    const { blobs } = await list({ prefix: 'transcripts/' });

    // Get already indexed video IDs (normalized)
    const existingResult = await sql`SELECT DISTINCT video_id FROM transcript_chunks`;
    const indexedVideoIds = new Set(existingResult.rows.map(r => r.video_id));

    const results: {
      videoId: string;
      normalizedId: string;
      status: string;
      chunks?: number;
      contentLength?: number;
      reason?: string;
    }[] = [];

    // Track processed normalized IDs to avoid duplicates
    const processedIds = new Set<string>();

    for (const blob of blobs) {
      // Extract videoId from filename: transcripts/{videoId}-{timestamp}.md
      const filename = blob.pathname.replace('transcripts/', '').replace('.md', '');
      const normalizedId = extractYouTubeVideoId(filename);

      // Skip if we've already processed this normalized ID in this run
      if (processedIds.has(normalizedId)) {
        results.push({
          videoId: filename,
          normalizedId,
          status: 'skipped (duplicate in this batch)',
        });
        continue;
      }

      // Skip if already indexed (unless clean mode)
      if (!clean && indexedVideoIds.has(normalizedId)) {
        results.push({
          videoId: filename,
          normalizedId,
          status: 'skipped (already indexed)',
        });
        processedIds.add(normalizedId);
        continue;
      }

      try {
        // Fetch the markdown content
        const response = await fetch(blob.url);
        const markdownContent = await response.text();

        // Extract title from markdown
        const firstLine = markdownContent.split('\n')[0];
        const title = firstLine?.startsWith('# ')
          ? firstLine.substring(2).trim()
          : normalizedId;

        // Generate embeddings (with validation)
        const result = await saveTranscriptEmbeddings({
          blobUrl: blob.url,
          videoId: normalizedId,
          videoTitle: title,
          markdownContent,
        });

        processedIds.add(normalizedId);

        if (result.validation.valid) {
          results.push({
            videoId: filename,
            normalizedId: result.normalizedVideoId,
            status: 'indexed',
            chunks: result.chunksCreated,
            contentLength: result.validation.contentLength,
          });
        } else {
          results.push({
            videoId: filename,
            normalizedId: result.normalizedVideoId,
            status: 'skipped (validation failed)',
            reason: result.validation.reason,
            contentLength: result.validation.contentLength,
          });
        }
      } catch (error) {
        results.push({
          videoId: filename,
          normalizedId,
          status: `error: ${error instanceof Error ? error.message : 'unknown'}`,
        });
      }
    }

    // Summary stats
    const indexed = results.filter(r => r.status === 'indexed');
    const skipped = results.filter(r => r.status.startsWith('skipped'));
    const errors = results.filter(r => r.status.startsWith('error'));

    return NextResponse.json({
      success: true,
      summary: {
        total: results.length,
        indexed: indexed.length,
        skipped: skipped.length,
        errors: errors.length,
        totalChunks: indexed.reduce((sum, r) => sum + (r.chunks || 0), 0),
      },
      results,
    });
  } catch (error) {
    console.error('Backfill error:', error);
    return NextResponse.json(
      { success: false, error: 'Backfill failed' },
      { status: 500 }
    );
  }
}
