/**
 * Supadata.ai API Client
 * Fetches YouTube transcripts reliably via Supadata's infrastructure
 */

import { logger } from '@/lib/logger';

const SUPADATA_API_URL = 'https://api.supadata.ai/v1';

export interface TranscriptSegment {
  text: string;
  offset: number;
  duration: number;
  lang: string;
}

export interface TranscriptResponse {
  content: string | TranscriptSegment[];
  lang: string;
  availableLangs: string[];
}

export interface TranscriptResult {
  transcript: string;
  language: string;
  segments: TranscriptSegment[];
}

/**
 * Fetch transcript from YouTube via Supadata.ai
 */
export async function fetchTranscript(
  videoId: string,
  preferredLang?: string
): Promise<TranscriptResult> {
  const apiKey = process.env.SUPADATA_API_KEY;

  if (!apiKey) {
    throw new Error('SUPADATA_API_KEY is not configured');
  }

  const params = new URLSearchParams({
    videoId,
    text: 'false', // Get timestamped segments
  });

  if (preferredLang) {
    params.set('lang', preferredLang);
  }

  const response = await fetch(
    `${SUPADATA_API_URL}/youtube/transcript?${params}`,
    {
      headers: {
        'x-api-key': apiKey,
      },
      signal: AbortSignal.timeout(30_000),
    }
  );

  if (!response.ok) {
    const error = await response.text();

    if (response.status === 404) {
      throw new Error('Inget transkript tillgängligt för denna video');
    }
    if (response.status === 401) {
      throw new Error('Supadata API-nyckel är ogiltig');
    }
    if (response.status === 429) {
      throw new Error('För många förfrågningar till Supadata. Försök igen senare.');
    }

    throw new Error(`Supadata error: ${response.status} - ${error}`);
  }

  const data: TranscriptResponse = await response.json();

  // Handle both text and segment responses
  let segments: TranscriptSegment[];
  let transcript: string;

  if (typeof data.content === 'string') {
    // Plain text response
    transcript = data.content;
    segments = [];
  } else {
    // Timestamped segments
    segments = data.content;
    transcript = segments.map(s => s.text).join(' ');
  }

  if (!transcript || transcript.trim().length === 0) {
    throw new Error('Transkriptet var tomt');
  }

  logger.info('Supadata: Transcript fetched', {
    lang: data.lang,
    chars: transcript.length,
    segments: segments.length,
  });

  return {
    transcript,
    language: data.lang,
    segments,
  };
}

/**
 * Check if a video has available transcripts via Supadata
 */
export async function hasTranscript(videoId: string): Promise<boolean> {
  try {
    const apiKey = process.env.SUPADATA_API_KEY;
    if (!apiKey) return false;

    const response = await fetch(
      `${SUPADATA_API_URL}/youtube/transcript?videoId=${videoId}&text=true`,
      {
        headers: {
          'x-api-key': apiKey,
        },
        signal: AbortSignal.timeout(15_000),
      }
    );

    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get available transcript languages for a video
 */
export async function getAvailableLanguages(videoId: string): Promise<string[]> {
  try {
    const apiKey = process.env.SUPADATA_API_KEY;
    if (!apiKey) return [];

    const response = await fetch(
      `${SUPADATA_API_URL}/youtube/transcript?videoId=${videoId}&text=true`,
      {
        headers: {
          'x-api-key': apiKey,
        },
        signal: AbortSignal.timeout(15_000),
      }
    );

    if (!response.ok) return [];

    const data: TranscriptResponse = await response.json();
    return data.availableLangs || [];
  } catch {
    return [];
  }
}
