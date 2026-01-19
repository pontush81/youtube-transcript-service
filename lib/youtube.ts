import { YoutubeTranscript } from 'youtube-transcript';

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

export async function fetchTranscript(videoId: string): Promise<string> {
  // Prova olika språk - svenska först, sen engelska, sen utan språk
  const languages = ['sv', 'en', undefined];

  for (const lang of languages) {
    try {
      const config = lang ? { lang } : undefined;
      const segments = await YoutubeTranscript.fetchTranscript(videoId, config);
      if (segments && segments.length > 0) {
        return segments.map(s => s.text).join(' ');
      }
    } catch {
      // Prova nästa språk
      continue;
    }
  }

  // Sista försök utan config
  const segments = await YoutubeTranscript.fetchTranscript(videoId);
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
