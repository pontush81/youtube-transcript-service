import { sql } from '@/lib/db';
import { getAIProvider } from '@/lib/ai/provider';
import { chunkTranscript, Chunk } from '@/lib/chunking';

interface SaveEmbeddingsParams {
  blobUrl: string;
  videoId: string;
  videoTitle: string;
  markdownContent: string;
}

export async function saveTranscriptEmbeddings(params: SaveEmbeddingsParams): Promise<number> {
  const { blobUrl, videoId, videoTitle, markdownContent } = params;
  const provider = getAIProvider('openai');

  // Chunk the transcript
  const chunks = chunkTranscript(markdownContent);

  if (chunks.length === 0) {
    return 0;
  }

  // Generate embeddings in batch
  const embeddings = await provider.embedBatch(chunks.map(c => c.content));

  // Delete existing chunks for this video (in case of re-import)
  await sql`DELETE FROM transcript_chunks WHERE video_id = ${videoId}`;

  // Insert new chunks
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const embedding = embeddings[i];
    const embeddingStr = `[${embedding.join(',')}]`;

    await sql`
      INSERT INTO transcript_chunks (blob_url, video_id, video_title, chunk_index, content, timestamp_start, embedding)
      VALUES (${blobUrl}, ${videoId}, ${videoTitle}, ${chunk.chunkIndex}, ${chunk.content}, ${chunk.timestampStart}, ${embeddingStr}::vector)
    `;
  }

  return chunks.length;
}

export async function deleteTranscriptEmbeddings(videoId: string): Promise<void> {
  await sql`DELETE FROM transcript_chunks WHERE video_id = ${videoId}`;
}
