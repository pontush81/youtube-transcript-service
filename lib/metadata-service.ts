import { YOUTUBE_CATEGORIES, VideoMetadata } from './youtube';
import { logger } from '@/lib/logger';

/**
 * YouTube oEmbed response
 */
interface OEmbedResponse {
  title: string;
  author_name: string;
  author_url: string;
  thumbnail_url: string;
  thumbnail_width: number;
  thumbnail_height: number;
}

/**
 * YouTube Data API v3 response types
 */
interface YouTubeApiVideoResponse {
  items: Array<{
    id: string;
    snippet: {
      title: string;
      description: string;
      publishedAt: string;
      channelId: string;
      channelTitle: string;
      thumbnails: {
        high?: { url: string };
        medium?: { url: string };
        default?: { url: string };
      };
      tags?: string[];
      categoryId?: string;
    };
    contentDetails: {
      duration: string; // ISO 8601 format: PT1H2M3S
    };
    statistics: {
      viewCount?: string;
      likeCount?: string;
    };
  }>;
}

interface YouTubeApiPlaylistResponse {
  items: Array<{
    id: string;
    snippet: {
      title: string;
      description: string;
      channelId: string;
      channelTitle: string;
      thumbnails: {
        high?: { url: string };
        medium?: { url: string };
        default?: { url: string };
      };
    };
    contentDetails: {
      itemCount: number;
    };
  }>;
}

interface YouTubeApiPlaylistItemsResponse {
  items: Array<{
    snippet: {
      title: string;
      position: number;
      resourceId: {
        videoId: string;
      };
      thumbnails: {
        high?: { url: string };
        medium?: { url: string };
        default?: { url: string };
      };
    };
  }>;
  nextPageToken?: string;
}

/**
 * Parse ISO 8601 duration to seconds
 * PT1H2M3S -> 3723
 */
function parseDuration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;

  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);

  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Fetch basic metadata using YouTube oEmbed (free, no API key)
 */
async function fetchOEmbedMetadata(videoId: string): Promise<Partial<VideoMetadata>> {
  try {
    const response = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      { signal: AbortSignal.timeout(10_000) }
    );

    if (!response.ok) {
      throw new Error(`oEmbed failed: ${response.status}`);
    }

    const data: OEmbedResponse = await response.json();

    // Extract channel ID from author_url if possible
    const channelMatch = data.author_url?.match(/channel\/([^/?]+)/);
    const channelId = channelMatch ? channelMatch[1] : null;

    return {
      videoId,
      title: data.title,
      description: null,
      durationSeconds: null,
      channelId,
      channelName: data.author_name,
      thumbnailUrl: data.thumbnail_url,
      publishedAt: null,
      viewCount: null,
      likeCount: null,
      tags: [],
      categoryId: null,
      categoryName: null,
    };
  } catch (error) {
    logger.error('oEmbed fetch failed', { error: error instanceof Error ? error.message : String(error) });
    return {
      videoId,
      title: `Video ${videoId}`,
      description: null,
      durationSeconds: null,
      channelId: null,
      channelName: null,
      thumbnailUrl: null,
      publishedAt: null,
      viewCount: null,
      likeCount: null,
      tags: [],
      categoryId: null,
      categoryName: null,
    };
  }
}

/**
 * Fetch rich metadata using YouTube Data API v3 (requires YOUTUBE_API_KEY)
 */
async function fetchYouTubeApiMetadata(videoId: string): Promise<VideoMetadata | null> {
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    return null;
  }

  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?` +
      `part=snippet,contentDetails,statistics&id=${videoId}&key=${apiKey}`,
      { signal: AbortSignal.timeout(10_000) }
    );

    if (!response.ok) {
      if (response.status === 403) {
        logger.error('YouTube API quota exceeded or key invalid');
      }
      return null;
    }

    const data: YouTubeApiVideoResponse = await response.json();

    if (!data.items || data.items.length === 0) {
      return null;
    }

    const video = data.items[0];
    const categoryId = video.snippet.categoryId
      ? parseInt(video.snippet.categoryId, 10)
      : null;

    return {
      videoId: video.id,
      title: video.snippet.title,
      description: video.snippet.description || null,
      durationSeconds: parseDuration(video.contentDetails.duration),
      channelId: video.snippet.channelId,
      channelName: video.snippet.channelTitle,
      thumbnailUrl:
        video.snippet.thumbnails.high?.url ||
        video.snippet.thumbnails.medium?.url ||
        video.snippet.thumbnails.default?.url ||
        null,
      publishedAt: video.snippet.publishedAt,
      viewCount: video.statistics.viewCount
        ? parseInt(video.statistics.viewCount, 10)
        : null,
      likeCount: video.statistics.likeCount
        ? parseInt(video.statistics.likeCount, 10)
        : null,
      tags: video.snippet.tags || [],
      categoryId,
      categoryName: categoryId ? YOUTUBE_CATEGORIES[categoryId] || null : null,
    };
  } catch (error) {
    logger.error('YouTube API fetch failed', { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

/**
 * Fetch video metadata - uses YouTube Data API if available, falls back to oEmbed
 */
export async function fetchVideoMetadata(videoId: string): Promise<VideoMetadata> {
  // Try YouTube Data API first (richer data)
  const apiMetadata = await fetchYouTubeApiMetadata(videoId);
  if (apiMetadata) {
    return apiMetadata;
  }

  // Fall back to oEmbed (basic data, always works)
  const oembedMetadata = await fetchOEmbedMetadata(videoId);
  return oembedMetadata as VideoMetadata;
}

/**
 * Fetch video title only (fast, for display purposes)
 */
export async function fetchVideoTitle(videoId: string): Promise<string> {
  try {
    const response = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      { signal: AbortSignal.timeout(10_000) }
    );
    const data = await response.json();
    return data.title || `Video ${videoId}`;
  } catch {
    return `Video ${videoId}`;
  }
}

/**
 * Playlist metadata
 */
export interface PlaylistMetadata {
  id: string;
  title: string;
  description: string;
  channelId: string;
  channelTitle: string;
  videoCount: number;
  thumbnail: string;
}

/**
 * Playlist video item
 */
export interface PlaylistVideo {
  videoId: string;
  title: string;
  thumbnail: string;
  position: number;
}

/**
 * Fetch playlist metadata (requires YOUTUBE_API_KEY)
 */
export async function fetchPlaylistMetadata(
  playlistId: string
): Promise<PlaylistMetadata> {
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    throw new Error(
      'YOUTUBE_API_KEY krävs för spellistor. Lägg till den i miljövariabler.'
    );
  }

  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/playlists?` +
    `part=snippet,contentDetails&id=${playlistId}&key=${apiKey}`,
    { signal: AbortSignal.timeout(10_000) }
  );

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Spellistan hittades inte');
    }
    if (response.status === 403) {
      throw new Error('YouTube API-kvoten är slut eller nyckeln är ogiltig');
    }
    throw new Error(`API-fel: ${response.status}`);
  }

  const data: YouTubeApiPlaylistResponse = await response.json();

  if (!data.items || data.items.length === 0) {
    throw new Error('Spellistan hittades inte');
  }

  const playlist = data.items[0];

  return {
    id: playlist.id,
    title: playlist.snippet.title,
    description: playlist.snippet.description,
    channelId: playlist.snippet.channelId,
    channelTitle: playlist.snippet.channelTitle,
    videoCount: playlist.contentDetails.itemCount,
    thumbnail:
      playlist.snippet.thumbnails.high?.url ||
      playlist.snippet.thumbnails.medium?.url ||
      playlist.snippet.thumbnails.default?.url ||
      '',
  };
}

/**
 * Fetch all videos in a playlist (requires YOUTUBE_API_KEY)
 */
export async function fetchPlaylistVideos(
  playlistId: string
): Promise<PlaylistVideo[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    throw new Error(
      'YOUTUBE_API_KEY krävs för spellistor. Lägg till den i miljövariabler.'
    );
  }

  const videos: PlaylistVideo[] = [];
  let nextPageToken: string | undefined;

  do {
    const url = new URL('https://www.googleapis.com/youtube/v3/playlistItems');
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('playlistId', playlistId);
    url.searchParams.set('maxResults', '50');
    url.searchParams.set('key', apiKey);
    if (nextPageToken) {
      url.searchParams.set('pageToken', nextPageToken);
    }

    const response = await fetch(url.toString(), { signal: AbortSignal.timeout(10_000) });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Spellistan hittades inte');
      }
      throw new Error(`API-fel: ${response.status}`);
    }

    const data: YouTubeApiPlaylistItemsResponse = await response.json();

    for (const item of data.items) {
      videos.push({
        videoId: item.snippet.resourceId.videoId,
        title: item.snippet.title,
        thumbnail:
          item.snippet.thumbnails.high?.url ||
          item.snippet.thumbnails.medium?.url ||
          item.snippet.thumbnails.default?.url ||
          '',
        position: item.snippet.position,
      });
    }

    nextPageToken = data.nextPageToken;
  } while (nextPageToken);

  return videos;
}

/**
 * Check if YouTube Data API is configured
 */
export function hasYouTubeApiKey(): boolean {
  return !!process.env.YOUTUBE_API_KEY;
}
