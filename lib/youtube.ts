/**
 * YouTube utilities
 *
 * Transcripts: Uses Supadata.ai (reliable, paid)
 * Metadata: Uses YouTube oEmbed (free) + YouTube Data API v3 (optional, for rich data)
 * Playlists: Requires YOUTUBE_API_KEY
 */

import { fetchTranscript as fetchTranscriptSupadata } from './supadata';
import {
  fetchVideoMetadata as fetchMetadataService,
  fetchVideoTitle as fetchTitleService,
  fetchPlaylistMetadata as fetchPlaylistMetadataService,
  fetchPlaylistVideos as fetchPlaylistVideosService,
  hasYouTubeApiKey,
} from './metadata-service';

// Re-export types
export type { PlaylistMetadata, PlaylistVideo } from './metadata-service';

/**
 * Extract video ID from YouTube URL
 */
export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([^&\n?#]+)/,
    /(?:youtu\.be\/)([^&\n?#]+)/,
    /(?:youtube\.com\/embed\/)([^&\n?#]+)/,
    /(?:youtube\.com\/v\/)([^&\n?#]+)/,
    /(?:youtube\.com\/shorts\/)([^&\n?#]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

/**
 * Extract playlist ID from YouTube URL
 */
export function extractPlaylistId(url: string): string | null {
  const patterns = [/[?&]list=([^&\n?#]+)/];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

/**
 * Check if URL is a playlist URL
 */
export function isPlaylistUrl(url: string): boolean {
  return extractPlaylistId(url) !== null;
}

/**
 * YouTube category ID to name mapping
 */
export const YOUTUBE_CATEGORIES: Record<number, string> = {
  1: 'Film & Animation',
  2: 'Autos & Vehicles',
  10: 'Music',
  15: 'Pets & Animals',
  17: 'Sports',
  18: 'Short Movies',
  19: 'Travel & Events',
  20: 'Gaming',
  21: 'Videoblogging',
  22: 'People & Blogs',
  23: 'Comedy',
  24: 'Entertainment',
  25: 'News & Politics',
  26: 'Howto & Style',
  27: 'Education',
  28: 'Science & Technology',
  29: 'Nonprofits & Activism',
  30: 'Movies',
  31: 'Anime/Animation',
  32: 'Action/Adventure',
  33: 'Classics',
  34: 'Comedy',
  35: 'Documentary',
  36: 'Drama',
  37: 'Family',
  38: 'Foreign',
  39: 'Horror',
  40: 'Sci-Fi/Fantasy',
  41: 'Thriller',
  42: 'Shorts',
  43: 'Shows',
  44: 'Trailers',
};

/**
 * Video metadata interface
 */
export interface VideoMetadata {
  videoId: string;
  title: string;
  description: string | null;
  durationSeconds: number | null;
  channelId: string | null;
  channelName: string | null;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  viewCount: number | null;
  likeCount: number | null;
  tags: string[];
  categoryId: number | null;
  categoryName: string | null;
  transcriptLanguage?: string;
}

/**
 * Fetch transcript from YouTube video
 * Uses Supadata.ai for reliable transcript fetching
 */
export async function fetchTranscript(
  videoId: string,
  preferredLang?: string
): Promise<string> {
  const result = await fetchTranscriptSupadata(videoId, preferredLang);
  return result.transcript;
}

/**
 * Fetch video metadata
 * Uses YouTube Data API v3 if YOUTUBE_API_KEY is set, otherwise falls back to oEmbed
 */
export async function fetchVideoMetadata(videoId: string): Promise<VideoMetadata> {
  return fetchMetadataService(videoId);
}

/**
 * Fetch video title (fast, oEmbed only)
 */
export async function fetchVideoTitle(videoId: string): Promise<string> {
  return fetchTitleService(videoId);
}

/**
 * Fallback metadata fetcher (oEmbed only)
 * For backwards compatibility
 */
export async function fetchVideoMetadataFallback(
  videoId: string
): Promise<Partial<VideoMetadata>> {
  try {
    const response = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
    );
    const data = await response.json();
    return {
      videoId,
      title: data.title || `Video ${videoId}`,
      channelName: data.author_name || null,
      thumbnailUrl: data.thumbnail_url || null,
    };
  } catch {
    return {
      videoId,
      title: `Video ${videoId}`,
    };
  }
}

/**
 * Fetch playlist metadata
 * Requires YOUTUBE_API_KEY environment variable
 */
export async function fetchPlaylistMetadata(playlistId: string) {
  return fetchPlaylistMetadataService(playlistId);
}

/**
 * Fetch videos in a playlist
 * Requires YOUTUBE_API_KEY environment variable
 */
export async function fetchPlaylistVideos(playlistId: string) {
  return fetchPlaylistVideosService(playlistId);
}

/**
 * Check if playlist functionality is available
 */
export function isPlaylistEnabled(): boolean {
  return hasYouTubeApiKey();
}

/**
 * Check if rich metadata is available (YouTube Data API)
 */
export function hasRichMetadata(): boolean {
  return hasYouTubeApiKey();
}
