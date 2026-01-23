/**
 * YouTube Transcript Service
 * Fetches transcripts directly from YouTube without external API dependencies
 */

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

interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  name: { simpleText?: string };
  isTranslatable: boolean;
}

interface PlayerResponse {
  captions?: {
    playerCaptionsTracklistRenderer?: {
      captionTracks?: CaptionTrack[];
    };
  };
}

/**
 * Extract player response from YouTube page
 */
async function getPlayerResponse(videoId: string): Promise<PlayerResponse | null> {
  const url = `https://www.youtube.com/watch?v=${videoId}`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch video page: ${response.status}`);
  }

  const html = await response.text();

  // Extract ytInitialPlayerResponse from the page
  const playerResponseMatch = html.match(
    /ytInitialPlayerResponse\s*=\s*({.+?})\s*;/
  );

  if (!playerResponseMatch) {
    // Try alternative pattern
    const altMatch = html.match(/var ytInitialPlayerResponse\s*=\s*({.+?});/);
    if (!altMatch) {
      return null;
    }
    try {
      return JSON.parse(altMatch[1]);
    } catch {
      return null;
    }
  }

  try {
    return JSON.parse(playerResponseMatch[1]);
  } catch {
    return null;
  }
}

/**
 * Fetch and parse transcript XML
 */
async function fetchTranscriptXml(url: string): Promise<TranscriptSegment[]> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch transcript: ${response.status}`);
  }

  const xml = await response.text();
  const segments: TranscriptSegment[] = [];

  // Parse XML manually (works in all environments)
  const textRegex = /<text start="([\d.]+)" dur="([\d.]+)"[^>]*>([^<]*)<\/text>/g;
  let match;

  while ((match = textRegex.exec(xml)) !== null) {
    const offset = parseFloat(match[1]) * 1000; // Convert to ms
    const duration = parseFloat(match[2]) * 1000;
    let text = match[3];

    // Decode HTML entities
    text = text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/\n/g, ' ')
      .trim();

    if (text) {
      segments.push({ text, offset, duration });
    }
  }

  return segments;
}

/**
 * Fetch transcript from YouTube video
 * Extracts captions directly from YouTube without external API
 *
 * @param videoId YouTube video ID
 * @param preferredLang Preferred language code (e.g., 'sv', 'en')
 * @returns Transcript text and metadata
 */
export async function fetchTranscript(
  videoId: string,
  preferredLang?: string
): Promise<TranscriptResult> {
  // Get player response from YouTube
  const playerResponse = await getPlayerResponse(videoId);

  if (!playerResponse) {
    throw new Error('Kunde inte hämta videoinformation');
  }

  const captionTracks =
    playerResponse.captions?.playerCaptionsTracklistRenderer?.captionTracks;

  if (!captionTracks || captionTracks.length === 0) {
    throw new Error('Inget transkript tillgängligt för denna video');
  }

  // Language priority: user preference -> Swedish -> English -> first available
  const langPriority = preferredLang
    ? [preferredLang, 'sv', 'en']
    : ['sv', 'en'];

  // Find best matching caption track
  let selectedTrack: CaptionTrack | null = null;

  for (const lang of langPriority) {
    const track = captionTracks.find(
      (t) => t.languageCode === lang || t.languageCode.startsWith(lang + '-')
    );
    if (track) {
      selectedTrack = track;
      break;
    }
  }

  // Fall back to first available track
  if (!selectedTrack) {
    selectedTrack = captionTracks[0];
  }

  // Fetch transcript XML
  const segments = await fetchTranscriptXml(selectedTrack.baseUrl);

  if (segments.length === 0) {
    throw new Error('Transkriptet var tomt');
  }

  // Combine segments into transcript
  const transcript = segments.map((s) => s.text).join(' ');

  console.log(
    `Transcript fetched in ${selectedTrack.languageCode}, ${transcript.length} chars, ${segments.length} segments`
  );

  return {
    transcript,
    language: selectedTrack.languageCode,
    segments,
  };
}

/**
 * Check if a video has available transcripts
 */
export async function hasTranscript(videoId: string): Promise<boolean> {
  try {
    const playerResponse = await getPlayerResponse(videoId);
    const tracks =
      playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    return !!tracks && tracks.length > 0;
  } catch {
    return false;
  }
}

/**
 * Get available transcript languages for a video
 */
export async function getAvailableLanguages(
  videoId: string
): Promise<string[]> {
  try {
    const playerResponse = await getPlayerResponse(videoId);
    const tracks =
      playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!tracks) return [];
    return tracks.map((t) => t.languageCode);
  } catch {
    return [];
  }
}
