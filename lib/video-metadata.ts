import { sql } from '@/lib/db';
import { fetchVideoMetadata, fetchVideoMetadataFallback, VideoMetadata } from '@/lib/youtube';

/**
 * Save video metadata to the database
 */
export async function saveVideoMetadata(
  metadata: VideoMetadata & { transcriptLanguage?: string }
): Promise<void> {
  // Convert tags array to PostgreSQL array format
  const tagsArray = metadata.tags.length > 0
    ? `{${metadata.tags.map(t => `"${t.replace(/"/g, '\\"')}"`).join(',')}}`
    : null;

  await sql`
    INSERT INTO video_metadata (
      video_id, title, description, duration_seconds,
      channel_id, channel_name, thumbnail_url, published_at,
      view_count, like_count, tags, category_id, category_name,
      transcript_language, fetched_at, updated_at
    ) VALUES (
      ${metadata.videoId},
      ${metadata.title},
      ${metadata.description},
      ${metadata.durationSeconds},
      ${metadata.channelId},
      ${metadata.channelName},
      ${metadata.thumbnailUrl},
      ${metadata.publishedAt},
      ${metadata.viewCount},
      ${metadata.likeCount},
      ${tagsArray}::text[],
      ${metadata.categoryId},
      ${metadata.categoryName},
      ${metadata.transcriptLanguage || null},
      NOW(),
      NOW()
    )
    ON CONFLICT (video_id) DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      duration_seconds = EXCLUDED.duration_seconds,
      channel_id = EXCLUDED.channel_id,
      channel_name = EXCLUDED.channel_name,
      thumbnail_url = EXCLUDED.thumbnail_url,
      published_at = EXCLUDED.published_at,
      view_count = EXCLUDED.view_count,
      like_count = EXCLUDED.like_count,
      tags = EXCLUDED.tags,
      category_id = COALESCE(EXCLUDED.category_id, video_metadata.category_id),
      category_name = COALESCE(EXCLUDED.category_name, video_metadata.category_name),
      transcript_language = COALESCE(EXCLUDED.transcript_language, video_metadata.transcript_language),
      updated_at = NOW()
  `;
}

/**
 * Get video metadata from database
 */
export async function getVideoMetadata(videoId: string): Promise<VideoMetadata | null> {
  const result = await sql`
    SELECT * FROM video_metadata WHERE video_id = ${videoId}
  `;

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    videoId: row.video_id,
    title: row.title,
    description: row.description,
    durationSeconds: row.duration_seconds,
    channelId: row.channel_id,
    channelName: row.channel_name,
    thumbnailUrl: row.thumbnail_url,
    publishedAt: row.published_at,
    viewCount: row.view_count,
    likeCount: row.like_count,
    tags: row.tags || [],
    categoryId: row.category_id,
    categoryName: row.category_name,
    transcriptLanguage: row.transcript_language,
  };
}

/**
 * Get all video metadata
 */
export async function getAllVideoMetadata(): Promise<Map<string, VideoMetadata>> {
  const result = await sql`SELECT * FROM video_metadata`;

  const map = new Map<string, VideoMetadata>();
  for (const row of result.rows) {
    map.set(row.video_id, {
      videoId: row.video_id,
      title: row.title,
      description: row.description,
      durationSeconds: row.duration_seconds,
      channelId: row.channel_id,
      channelName: row.channel_name,
      thumbnailUrl: row.thumbnail_url,
      publishedAt: row.published_at,
      viewCount: row.view_count,
      likeCount: row.like_count,
      tags: row.tags || [],
      categoryId: row.category_id,
      categoryName: row.category_name,
      transcriptLanguage: row.transcript_language,
    });
  }

  return map;
}

/**
 * Get unique channels from metadata
 */
export async function getChannels(): Promise<Array<{ channelId: string; channelName: string; videoCount: number }>> {
  const result = await sql`
    SELECT channel_id, channel_name, COUNT(*) as video_count
    FROM video_metadata
    WHERE channel_id IS NOT NULL
    GROUP BY channel_id, channel_name
    ORDER BY video_count DESC
  `;

  return result.rows.map(row => ({
    channelId: row.channel_id,
    channelName: row.channel_name,
    videoCount: parseInt(row.video_count, 10),
  }));
}

/**
 * Get unique categories from metadata
 */
export async function getCategories(): Promise<Array<{ categoryId: number; categoryName: string; videoCount: number }>> {
  const result = await sql`
    SELECT category_id, category_name, COUNT(*) as video_count
    FROM video_metadata
    WHERE category_id IS NOT NULL
    GROUP BY category_id, category_name
    ORDER BY video_count DESC
  `;

  return result.rows.map(row => ({
    categoryId: row.category_id,
    categoryName: row.category_name,
    videoCount: parseInt(row.video_count, 10),
  }));
}

/**
 * Fetch and save metadata for a video
 * Uses Supadata API with oEmbed fallback
 */
export async function fetchAndSaveVideoMetadata(
  videoId: string,
  transcriptLanguage?: string
): Promise<VideoMetadata> {
  let metadata: VideoMetadata;

  try {
    // Try Supadata first (rich metadata)
    metadata = await fetchVideoMetadata(videoId);
  } catch {
    // Fallback to oEmbed (basic metadata)
    const fallback = await fetchVideoMetadataFallback(videoId);
    metadata = {
      videoId,
      title: fallback.title || `Video ${videoId}`,
      description: null,
      durationSeconds: null,
      channelId: null,
      channelName: fallback.channelName || null,
      thumbnailUrl: fallback.thumbnailUrl || null,
      publishedAt: null,
      viewCount: null,
      likeCount: null,
      tags: [],
      categoryId: null,
      categoryName: null,
    };
  }

  // Save to database
  await saveVideoMetadata({ ...metadata, transcriptLanguage });

  return metadata;
}
