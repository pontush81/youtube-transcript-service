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
}

interface TranscriptsResponse {
  transcripts: TranscriptItem[];
  isAuthenticated: boolean;
  userTranscriptCount: number;
}

const fetcher = async (url: string): Promise<TranscriptsResponse> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Kunde inte hämta transkript');
  }
  return response.json();
};

export function useTranscripts(myOnly = false) {
  const url = myOnly ? '/api/transcripts?my=true' : '/api/transcripts';
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
    isAuthenticated: data?.isAuthenticated ?? false,
    userTranscriptCount: data?.userTranscriptCount ?? 0,
    isLoading,
    isError: error,
    error: error?.message,
    mutate,
  };
}
