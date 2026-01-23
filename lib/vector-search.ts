import { sql } from '@/lib/db';
import { getAIProvider } from '@/lib/ai/provider';
import { TranscriptChunk } from '@/lib/ai/types';

// Sanitize video ID to prevent SQL injection
// YouTube video IDs are 11 chars: alphanumeric, hyphens, underscores
function sanitizeVideoId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 11);
}

interface SearchParams {
  query: string;
  videoIds: string[] | 'all';
  minSimilarity?: number;
  maxChunksPerVideo?: number;
}

interface SearchResult extends TranscriptChunk {
  similarity: number;
}

export async function searchTranscripts(params: SearchParams): Promise<SearchResult[]> {
  const {
    query,
    videoIds,
    minSimilarity = 0.3,
    maxChunksPerVideo = 5
  } = params;

  const provider = getAIProvider('openai');

  // Generate embedding for the query
  const queryEmbedding = await provider.embed(query);
  const embeddingStr = `[${queryEmbedding.join(',')}]`;

  // Build the query based on video selection
  let results;

  if (videoIds === 'all') {
    // Ensure at least 1 chunk per video is included (the best match),
    // plus additional chunks that meet the similarity threshold.
    // This ensures broad queries like "summarize all videos" include every video.
    results = await sql.query(
      `WITH ranked AS (
        SELECT
          video_id,
          video_title,
          content,
          timestamp_start,
          1 - (embedding <=> $1::vector) as similarity,
          ROW_NUMBER() OVER (PARTITION BY video_id ORDER BY embedding <=> $1::vector) as rn
        FROM transcript_chunks
      )
      SELECT video_id, video_title, content, timestamp_start, similarity
      FROM ranked
      WHERE rn = 1  -- Always include best chunk per video
         OR (rn <= $3 AND similarity >= $2)  -- Plus more if they meet threshold
      ORDER BY similarity DESC
      LIMIT 40`,
      [embeddingStr, minSimilarity, maxChunksPerVideo]
    );
  } else {
    // When specific videos are selected, don't apply similarity threshold
    // Users explicitly want results from these videos
    // Sanitize video IDs to prevent SQL injection
    const sanitizedIds = videoIds
      .map(sanitizeVideoId)
      .filter(id => id.length === 11); // Valid YouTube IDs are exactly 11 chars

    if (sanitizedIds.length === 0) {
      return [];
    }

    // Use proper parameterized array binding
    // Convert to JSON array which PostgreSQL can parse safely
    const videoIdsJson = JSON.stringify(sanitizedIds);

    results = await sql.query(
      `WITH ranked AS (
        SELECT
          video_id,
          video_title,
          content,
          timestamp_start,
          1 - (embedding <=> $1::vector) as similarity,
          ROW_NUMBER() OVER (PARTITION BY video_id ORDER BY embedding <=> $1::vector) as rn
        FROM transcript_chunks
        WHERE video_id = ANY(SELECT jsonb_array_elements_text($3::jsonb))
      )
      SELECT video_id, video_title, content, timestamp_start, similarity
      FROM ranked
      WHERE rn <= $2
      ORDER BY similarity DESC
      LIMIT 20`,
      [embeddingStr, maxChunksPerVideo, videoIdsJson]
    );
  }

  return results.rows.map(row => ({
    videoId: row.video_id,
    videoTitle: row.video_title,
    content: row.content,
    timestampStart: row.timestamp_start,
    similarity: row.similarity,
  }));
}

export async function getIndexedVideoIds(): Promise<string[]> {
  const result = await sql`
    SELECT DISTINCT video_id FROM transcript_chunks ORDER BY video_id
  `;
  return result.rows.map(row => row.video_id);
}
