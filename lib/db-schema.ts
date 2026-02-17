import { sql } from '@/lib/db';

/**
 * Calculate optimal IVFFlat lists parameter based on row count.
 * Recommendation: sqrt(n) for < 1M rows, sqrt(n) / 10 for larger.
 * Minimum 10 for very small datasets.
 */
function calculateOptimalLists(rowCount: number): number {
  if (rowCount < 100) return 10;
  if (rowCount < 1000) return Math.max(10, Math.floor(Math.sqrt(rowCount)));
  return Math.max(50, Math.floor(Math.sqrt(rowCount)));
}

export async function setupDatabase() {
  // Enable pgvector extension
  await sql`CREATE EXTENSION IF NOT EXISTS vector`;

  // ==========================================
  // Users table (managed by Clerk webhook)
  // ==========================================

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT UNIQUE,
      image TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // ==========================================
  // User transcripts ownership
  // ==========================================

  // User transcripts table (links users to their transcripts)
  await sql`
    CREATE TABLE IF NOT EXISTS user_transcripts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      video_id TEXT NOT NULL,
      blob_url TEXT NOT NULL,
      is_public BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, video_id)
    )
  `;

  // Index for user lookups
  await sql`
    CREATE INDEX IF NOT EXISTS user_transcripts_user_id_idx
    ON user_transcripts (user_id)
  `;

  // Index for public transcripts
  await sql`
    CREATE INDEX IF NOT EXISTS user_transcripts_public_idx
    ON user_transcripts (is_public) WHERE is_public = true
  `;

  // Index for video_id lookups (used in delete operations)
  await sql`
    CREATE INDEX IF NOT EXISTS user_transcripts_video_id_idx
    ON user_transcripts (video_id)
  `;

  // ==========================================
  // Rate limits table (PostgreSQL-based rate limiting)
  // ==========================================

  await sql`
    CREATE TABLE IF NOT EXISTS rate_limits (
      identifier TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      window_start BIGINT NOT NULL,
      request_count INTEGER DEFAULT 1,
      PRIMARY KEY (identifier, endpoint, window_start)
    )
  `;

  // ==========================================
  // Transcript chunks table
  // ==========================================

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
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Create index for video_id lookups first (always useful)
  await sql`
    CREATE INDEX IF NOT EXISTS transcript_chunks_video_id_idx
    ON transcript_chunks (video_id)
  `;

  // Index for blob_url lookups (used in deletion operations)
  await sql`
    CREATE INDEX IF NOT EXISTS transcript_chunks_blob_url_idx
    ON transcript_chunks (blob_url)
  `;

  // Composite index for sorted queries by video
  await sql`
    CREATE INDEX IF NOT EXISTS transcript_chunks_video_created_idx
    ON transcript_chunks (video_id, created_at)
  `;

  // For IVFFlat, check row count and create/recreate index if needed
  // IVFFlat requires rows to exist for optimal training
  const countResult = await sql`SELECT COUNT(*) as count FROM transcript_chunks`;
  const rowCount = parseInt(countResult.rows[0]?.count || '0', 10);

  if (rowCount > 0) {
    const optimalLists = calculateOptimalLists(rowCount);

    // Drop and recreate index with optimal lists value
    // Note: In production, you might want to use CONCURRENTLY
    await sql`DROP INDEX IF EXISTS transcript_chunks_embedding_idx`;
    await sql.query(`
      CREATE INDEX transcript_chunks_embedding_idx
      ON transcript_chunks
      USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = ${optimalLists})
    `);

    return {
      success: true,
      rowCount,
      indexLists: optimalLists,
    };
  }

  // For empty tables, create a basic index that will be rebuilt later
  await sql`
    CREATE INDEX IF NOT EXISTS transcript_chunks_embedding_idx
    ON transcript_chunks
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 10)
  `;

  return { success: true, rowCount: 0, indexLists: 10 };
}

/**
 * Optimize the vector index based on current data size.
 * Call this after bulk inserts to ensure optimal search performance.
 */
export async function optimizeVectorIndex(): Promise<{ rowCount: number; lists: number }> {
  const countResult = await sql`SELECT COUNT(*) as count FROM transcript_chunks`;
  const rowCount = parseInt(countResult.rows[0]?.count || '0', 10);

  if (rowCount === 0) {
    return { rowCount: 0, lists: 10 };
  }

  const optimalLists = calculateOptimalLists(rowCount);

  // Rebuild index with optimal parameters
  await sql`DROP INDEX IF EXISTS transcript_chunks_embedding_idx`;
  await sql.query(`
    CREATE INDEX transcript_chunks_embedding_idx
    ON transcript_chunks
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = ${optimalLists})
  `);

  return { rowCount, lists: optimalLists };
}
