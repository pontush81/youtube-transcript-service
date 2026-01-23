'use client';

import useSWR from 'swr';

interface TranscriptItem {
  videoId: string;
  title: string;
  url: string;
  uploadedAt: string;
  size: number;
}

interface TranscriptsResponse {
  transcripts: TranscriptItem[];
}

const fetcher = async (url: string): Promise<TranscriptsResponse> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Kunde inte hämta transkript');
  }
  return response.json();
};

export function useTranscripts() {
  const { data, error, isLoading, mutate } = useSWR<TranscriptsResponse>(
    '/api/transcripts',
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateIfStale: true,
      dedupingInterval: 10000, // 10 seconds
    }
  );

  return {
    transcripts: data?.transcripts ?? [],
    isLoading,
    isError: error,
    error: error?.message,
    mutate,
  };
}
