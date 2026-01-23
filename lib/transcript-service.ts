import { YoutubeTranscript, YoutubeTranscriptError } from 'youtube-transcript';

export interface TranscriptSegment {
  text: string;
  offset: number;
  duration: number;
}

export interface TranscriptResult {
  transcript: string;
  language: string;
  segments: TranscriptSegment[];
}

/**
 * Fetch transcript from YouTube video using youtube-transcript package.
 * No API key required - extracts existing YouTube captions.
 *
 * @param videoId YouTube video ID
 * @param preferredLang Preferred language code (e.g., 'sv', 'en')
 * @returns Transcript text and metadata
 */
export async function fetchTranscript(
  videoId: string,
  preferredLang?: string
): Promise<TranscriptResult> {
  // Language priority: user preference -> Swedish -> English -> any available
  const langPriority = preferredLang
    ? [preferredLang, 'sv', 'en']
    : ['sv', 'en'];

  let lastError: Error | null = null;

  // Try each language in priority order
  for (const lang of langPriority) {
    try {
      const segments = await YoutubeTranscript.fetchTranscript(videoId, { lang });

      if (segments && segments.length > 0) {
        const transcript = segments
          .map(segment => segment.text.replace(/\n/g, ' ').trim())
          .filter(Boolean)
          .join(' ');

        if (transcript.length > 0) {
          console.log(`Transcript fetched in ${lang}, ${transcript.length} chars`);
          return {
            transcript,
            language: lang,
            segments: segments.map(s => ({
              text: s.text,
              offset: s.offset,
              duration: s.duration,
            })),
          };
        }
      }
    } catch (error) {
      lastError = error as Error;
      // Continue trying other languages
    }
  }

  // If no preferred language worked, try without language specification
  try {
    const segments = await YoutubeTranscript.fetchTranscript(videoId);

    if (segments && segments.length > 0) {
      const transcript = segments
        .map(segment => segment.text.replace(/\n/g, ' ').trim())
        .filter(Boolean)
        .join(' ');

      if (transcript.length > 0) {
        // Try to detect language from response
        const detectedLang = (segments[0] as { lang?: string }).lang || 'unknown';
        console.log(`Transcript fetched in ${detectedLang}, ${transcript.length} chars`);
        return {
          transcript,
          language: detectedLang,
          segments: segments.map(s => ({
            text: s.text,
            offset: s.offset,
            duration: s.duration,
          })),
        };
      }
    }
  } catch (error) {
    lastError = error as Error;
  }

  // Handle specific error types
  if (lastError) {
    const errorMessage = lastError.message || String(lastError);

    if (errorMessage.includes('disabled') || lastError instanceof YoutubeTranscriptError) {
      throw new Error('Transkript är inaktiverat för denna video');
    }
    if (errorMessage.includes('unavailable')) {
      throw new Error('Videon hittades inte eller är inte tillgänglig');
    }
    if (errorMessage.includes('Too many requests')) {
      throw new Error('För många förfrågningar. Försök igen senare.');
    }
  }

  throw new Error('Inget transkript tillgängligt för denna video');
}

/**
 * Check if a video has available transcripts
 */
export async function hasTranscript(videoId: string): Promise<boolean> {
  try {
    const segments = await YoutubeTranscript.fetchTranscript(videoId);
    return segments && segments.length > 0;
  } catch {
    return false;
  }
}
