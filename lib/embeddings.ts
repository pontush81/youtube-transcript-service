import { sql, db } from '@/lib/db';
import { getAIProvider } from '@/lib/ai/provider';
import { chunkTranscript, validateTranscriptContent } from '@/lib/chunking';
import { extractYouTubeVideoId } from '@/lib/video-utils';

interface SaveEmbeddingsParams {
  blobUrl: string;
  videoId: string;
  videoTitle: string;
  markdownContent: string;
}

interface SaveEmbeddingsResult {
  chunksCreated: number;
  normalizedVideoId: string;
  validation: {
    valid: boolean;
    reason?: string;
    contentLength: number;
  };
}

export async function saveTranscriptEmbeddings(params: SaveEmbeddingsParams): Promise<SaveEmbeddingsResult> {
  const { blobUrl, videoId, videoTitle, markdownContent } = params;

  // Normalize video ID to base YouTube ID
  const normalizedVideoId = extractYouTubeVideoId(videoId);

  // Validate transcript content
  const validation = validateTranscriptContent(markdownContent);
  if (!validation.valid) {
    return {
      chunksCreated: 0,
      normalizedVideoId,
      validation: {
        valid: false,
        reason: validation.reason,
        contentLength: validation.contentLength,
      },
    };
  }

  const provider = getAIProvider('openai');

  // Chunk the transcript
  const chunks = chunkTranscript(markdownContent);

  if (chunks.length === 0) {
    return {
      chunksCreated: 0,
      normalizedVideoId,
      validation: {
        valid: false,
        reason: 'No chunks created from content',
        contentLength: validation.contentLength,
      },
    };
  }

  // Generate embeddings in batch
  const embeddings = await provider.embedBatch(chunks.map(c => c.content));

  // Use a transaction to ensure delete+insert is atomic (prevents data loss if insert fails)
  const client = await db.connect();
  try {
    await client.sql`BEGIN`;

    // Delete existing chunks for this video (in case of re-import)
    await client.sql`DELETE FROM transcript_chunks WHERE video_id = ${normalizedVideoId}`;
    await client.sql`DELETE FROM transcript_chunks WHERE video_id LIKE ${normalizedVideoId + '%'}`;

    // Insert new chunks
    if (chunks.length > 0) {
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = embeddings[i];
        const embeddingStr = `[${embedding.join(',')}]`;
        await client.sql`
          INSERT INTO transcript_chunks (blob_url, video_id, video_title, chunk_index, content, timestamp_start, embedding)
          VALUES (${blobUrl}, ${normalizedVideoId}, ${videoTitle}, ${chunk.chunkIndex}, ${chunk.content}, ${chunk.timestampStart}, ${embeddingStr}::vector)
        `;
      }
    }

    await client.sql`COMMIT`;
  } catch (error) {
    await client.sql`ROLLBACK`;
    throw error;
  } finally {
    client.release();
  }

  return {
    chunksCreated: chunks.length,
    normalizedVideoId,
    validation: {
      valid: true,
      contentLength: validation.contentLength,
    },
  };
}

export async function deleteTranscriptEmbeddings(videoId: string): Promise<void> {
  const normalizedVideoId = extractYouTubeVideoId(videoId);
  // Delete both normalized and any legacy IDs
  await sql`DELETE FROM transcript_chunks WHERE video_id = ${normalizedVideoId}`;
  await sql`DELETE FROM transcript_chunks WHERE video_id LIKE ${normalizedVideoId + '%'}`;
}

interface SaveWebEmbeddingsParams {
  blobUrl: string;
  contentId: string;
  title: string;
  content: string;
}

export async function saveWebContentEmbeddings(params: SaveWebEmbeddingsParams): Promise<SaveEmbeddingsResult> {
  const { blobUrl, contentId, title, content } = params;

  // Validate content
  if (!content || content.length < 200) {
    return {
      chunksCreated: 0,
      normalizedVideoId: contentId,
      validation: {
        valid: false,
        reason: 'Content too short (less than 200 characters)',
        contentLength: content?.length || 0,
      },
    };
  }

  const provider = getAIProvider('openai');

  // Chunk the content (reuse existing chunking logic)
  // Create a simple markdown wrapper to use existing chunker
  const markdownContent = `# ${title}\n\n---\n\n${content}`;
  const chunks = chunkTranscript(markdownContent);

  if (chunks.length === 0) {
    return {
      chunksCreated: 0,
      normalizedVideoId: contentId,
      validation: {
        valid: false,
        reason: 'No chunks created from content',
        contentLength: content.length,
      },
    };
  }

  // Generate embeddings in batch
  const embeddings = await provider.embedBatch(chunks.map(c => c.content));

  // Use a transaction to ensure delete+insert is atomic
  const client = await db.connect();
  try {
    await client.sql`BEGIN`;

    // Delete existing chunks for this content
    await client.sql`DELETE FROM transcript_chunks WHERE video_id = ${contentId}`;

    // Insert chunks
    if (chunks.length > 0) {
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = embeddings[i];
        const embeddingStr = `[${embedding.join(',')}]`;
        await client.sql`
          INSERT INTO transcript_chunks (blob_url, video_id, video_title, chunk_index, content, timestamp_start, embedding)
          VALUES (${blobUrl}, ${contentId}, ${title}, ${chunk.chunkIndex}, ${chunk.content}, ${null}, ${embeddingStr}::vector)
        `;
      }
    }

    await client.sql`COMMIT`;
  } catch (error) {
    await client.sql`ROLLBACK`;
    throw error;
  } finally {
    client.release();
  }

  return {
    chunksCreated: chunks.length,
    normalizedVideoId: contentId,
    validation: {
      valid: true,
      contentLength: content.length,
    },
  };
}
