import { NextResponse } from 'next/server';
import { list } from '@vercel/blob';
import { saveTranscriptEmbeddings } from '@/lib/embeddings';
import { getIndexedVideoIds } from '@/lib/vector-search';

export async function POST() {
  try {
    const { blobs } = await list({ prefix: 'transcripts/' });
    const indexedVideoIds = await getIndexedVideoIds();

    const results: { videoId: string; status: string; chunks?: number }[] = [];

    for (const blob of blobs) {
      // Extract videoId from filename: transcripts/{videoId}-{timestamp}.md
      const filename = blob.pathname.replace('transcripts/', '').replace('.md', '');
      const parts = filename.split('-');
      const videoId = parts.slice(0, -1).join('-');

      // Skip if already indexed
      if (indexedVideoIds.includes(videoId)) {
        results.push({ videoId, status: 'skipped (already indexed)' });
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
          : videoId;

        // Generate embeddings
        const chunks = await saveTranscriptEmbeddings({
          blobUrl: blob.url,
          videoId,
          videoTitle: title,
          markdownContent,
        });

        results.push({ videoId, status: 'indexed', chunks });
      } catch (error) {
        results.push({
          videoId,
          status: `error: ${error instanceof Error ? error.message : 'unknown'}`
        });
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results
    });
  } catch (error) {
    console.error('Backfill error:', error);
    return NextResponse.json(
      { success: false, error: 'Backfill failed' },
      { status: 500 }
    );
  }
}
