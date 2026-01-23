'use client';

import useSWR from 'swr';

export interface TranscriptItem {
  videoId: string;
  title: string;
  url: string;
  uploadedAt: string;
  size: number;
  indexed?: boolean;
  isOwner?: boolean;
  // Metadata fields
  thumbnailUrl?: string;
  channelId?: string;
  channelName?: string;
  durationSeconds?: number;
  publishedAt?: string;
  viewCount?: number;
  tags?: string[];
}

export interface Channel {
  channelId: string;
  channelName: string;
  videoCount: number;
}

interface TranscriptsResponse {
  transcripts: TranscriptItem[];
  channels: Channel[];
  isAuthenticated: boolean;
  userTranscriptCount: number;
}

interface UseTranscriptsOptions {
  myOnly?: boolean;
  channelId?: string;
  sortBy?: 'uploadedAt' | 'duration' | 'views' | 'published' | 'title';
}

const fetcher = async (url: string): Promise<TranscriptsResponse> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Kunde inte hämta transkript');
  }
  return response.json();
};

export function useTranscripts(options: UseTranscriptsOptions | boolean = {}) {
  // Support legacy boolean parameter for myOnly
  const opts = typeof options === 'boolean' ? { myOnly: options } : options;
  const { myOnly = false, channelId, sortBy } = opts;

  // Build URL with query params
  const params = new URLSearchParams();
  if (myOnly) params.set('my', 'true');
  if (channelId) params.set('channel', channelId);
  if (sortBy) params.set('sort', sortBy);

  const queryString = params.toString();
  const url = `/api/transcripts${queryString ? `?${queryString}` : ''}`;

  const { data, error, isLoading, mutate } = useSWR<TranscriptsResponse>(
    url,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateIfStale: true,
      dedupingInterval: 10000, // 10 seconds
    }
  );

  return {
    transcripts: data?.transcripts ?? [],
    channels: data?.channels ?? [],
    isAuthenticated: data?.isAuthenticated ?? false,
    userTranscriptCount: data?.userTranscriptCount ?? 0,
    isLoading,
    isError: error,
    error: error?.message,
    mutate,
  };
}

// Helper function to format duration
export function formatDuration(seconds: number | undefined): string {
  if (!seconds) return '';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// Helper function to format view count
export function formatViewCount(count: number | undefined): string {
  if (!count) return '';

  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M visningar`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}K visningar`;
  }
  return `${count} visningar`;
}
