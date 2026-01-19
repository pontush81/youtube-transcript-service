interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  name: string;
}

interface TranscriptSegment {
  text: string;
  start: number;
  duration: number;
}

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

async function getCaptionTracks(videoId: string): Promise<CaptionTrack[]> {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const response = await fetch(watchUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  const html = await response.text();

  // Extrahera varje caption track individuellt
  const tracks: CaptionTrack[] = [];
  const trackRegex = /"baseUrl":"(https:\/\/www\.youtube\.com\/api\/timedtext[^"]+)","name":\{"simpleText":"([^"]+)"\}[^}]*"languageCode":"([^"]+)"/g;

  let match;
  while ((match = trackRegex.exec(html)) !== null) {
    tracks.push({
      baseUrl: match[1].replace(/\\u0026/g, '&'),
      name: match[2],
      languageCode: match[3],
    });
  }

  // Alternativ regex om första inte matchar
  if (tracks.length === 0) {
    const altRegex = /"baseUrl":"(https:\/\/www\.youtube\.com\/api\/timedtext[^"]+)"[^}]*"languageCode":"([^"]+)"/g;
    while ((match = altRegex.exec(html)) !== null) {
      tracks.push({
        baseUrl: match[1].replace(/\\u0026/g, '&'),
        name: match[2],
        languageCode: match[2],
      });
    }
  }

  if (tracks.length === 0) {
    throw new Error('No captions found');
  }

  return tracks;
}

async function fetchCaptionXml(baseUrl: string): Promise<TranscriptSegment[]> {
  const response = await fetch(baseUrl);
  const xml = await response.text();

  const segments: TranscriptSegment[] = [];
  const regex = /<text start="([^"]+)" dur="([^"]+)"[^>]*>([^<]*)<\/text>/g;
  let match;

  while ((match = regex.exec(xml)) !== null) {
    const text = match[3]
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n/g, ' ')
      .trim();

    if (text) {
      segments.push({
        text,
        start: parseFloat(match[1]),
        duration: parseFloat(match[2]),
      });
    }
  }

  return segments;
}

export async function fetchTranscript(videoId: string): Promise<string> {
  const tracks = await getCaptionTracks(videoId);

  if (tracks.length === 0) {
    throw new Error('No caption tracks available');
  }

  // Prioritera: svenska, engelska, sedan första tillgängliga
  const preferredLanguages = ['sv', 'en'];
  let selectedTrack = tracks[0];

  for (const lang of preferredLanguages) {
    const track = tracks.find(t => t.languageCode.startsWith(lang));
    if (track) {
      selectedTrack = track;
      break;
    }
  }

  const segments = await fetchCaptionXml(selectedTrack.baseUrl);

  if (segments.length === 0) {
    throw new Error('No transcript segments found');
  }

  return segments.map(s => s.text).join(' ');
}

export async function fetchVideoTitle(videoId: string): Promise<string> {
  const res = await fetch(
    `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
  );

  if (!res.ok) {
    throw new Error('Kunde inte hämta videotitel');
  }

  const data = await res.json();
  return data.title;
}
