import { sql } from '@/lib/db';

export async function setupDatabase() {
  // Enable pgvector extension
  await sql`CREATE EXTENSION IF NOT EXISTS vector`;

  // Create transcript_chunks table
  await sql`
    CREATE TABLE IF NOT EXISTS transcript_chunks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      blob_url TEXT NOT NULL,
      video_id TEXT NOT NULL,
      video_title TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      content TEXT NOT NULL,
      timestamp_start TEXT,
      embedding vector(1536),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  // Create index for vector search (if table has rows)
  await sql`
    CREATE INDEX IF NOT EXISTS transcript_chunks_embedding_idx
    ON transcript_chunks
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100)
  `;

  // Create index for video_id lookups
  await sql`
    CREATE INDEX IF NOT EXISTS transcript_chunks_video_id_idx
    ON transcript_chunks (video_id)
  `;

  return { success: true };
}
