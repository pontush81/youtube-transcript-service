import { sql } from '@/lib/db';
import { getAIProvider } from '@/lib/ai/provider';
import { TranscriptChunk } from '@/lib/ai/types';

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
    minSimilarity = 0.7,
    maxChunksPerVideo = 5
  } = params;

  const provider = getAIProvider('openai');

  // Generate embedding for the query
  const queryEmbedding = await provider.embed(query);
  const embeddingStr = `[${queryEmbedding.join(',')}]`;

  // Build the query based on video selection
  let results;

  if (videoIds === 'all') {
    results = await sql`
      WITH ranked AS (
        SELECT
          video_id,
          video_title,
          content,
          timestamp_start,
          1 - (embedding <=> ${embeddingStr}::vector) as similarity,
          ROW_NUMBER() OVER (PARTITION BY video_id ORDER BY embedding <=> ${embeddingStr}::vector) as rn
        FROM transcript_chunks
        WHERE 1 - (embedding <=> ${embeddingStr}::vector) >= ${minSimilarity}
      )
      SELECT video_id, video_title, content, timestamp_start, similarity
      FROM ranked
      WHERE rn <= ${maxChunksPerVideo}
      ORDER BY similarity DESC
      LIMIT 20
    `;
  } else {
    // Convert array to PostgreSQL array literal format
    const videoIdsArray = `{${videoIds.join(',')}}`;
    results = await sql`
      WITH ranked AS (
        SELECT
          video_id,
          video_title,
          content,
          timestamp_start,
          1 - (embedding <=> ${embeddingStr}::vector) as similarity,
          ROW_NUMBER() OVER (PARTITION BY video_id ORDER BY embedding <=> ${embeddingStr}::vector) as rn
        FROM transcript_chunks
        WHERE video_id = ANY(${videoIdsArray}::text[])
          AND 1 - (embedding <=> ${embeddingStr}::vector) >= ${minSimilarity}
      )
      SELECT video_id, video_title, content, timestamp_start, similarity
      FROM ranked
      WHERE rn <= ${maxChunksPerVideo}
      ORDER BY similarity DESC
      LIMIT 20
    `;
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
