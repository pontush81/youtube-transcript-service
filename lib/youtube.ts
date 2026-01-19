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

// Metod 1: youtube-transcript paketet
async function fetchWithYoutubeTranscript(videoId: string): Promise<string | null> {
  try {
    const { YoutubeTranscript } = await import('youtube-transcript');
    const segments = await YoutubeTranscript.fetchTranscript(videoId);
    if (segments && segments.length > 0) {
      return segments.map(s => s.text).join(' ');
    }
  } catch (error) {
    console.log('youtube-transcript failed:', error);
  }
  return null;
}

// Metod 2: Direkt från YouTube HTML (som backup)
async function fetchFromYouTubeHtml(videoId: string): Promise<string | null> {
  try {
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const response = await fetch(watchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9,sv;q=0.8',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    const html = await response.text();

    // Hitta caption tracks via regex
    const trackRegex = /"baseUrl":"(https:\/\/www\.youtube\.com\/api\/timedtext[^"]+)"/g;
    const matches = [...html.matchAll(trackRegex)];
    
    if (matches.length === 0) {
      return null;
    }

    // Prova första URL:en
    const captionUrl = matches[0][1]
      .replace(/\\u0026/g, '&')
      .replace(/\\\//g, '/');
    
    const captionResponse = await fetch(captionUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    
    const xml = await captionResponse.text();
    
    if (!xml || xml.length === 0) {
      return null;
    }

    // Parse XML
    const segments: string[] = [];
    const regex = /<text[^>]*>([^<]*)<\/text>/g;
    let match;

    while ((match = regex.exec(xml)) !== null) {
      const text = match[1]
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\n/g, ' ')
        .trim();

      if (text) {
        segments.push(text);
      }
    }

    if (segments.length > 0) {
      return segments.join(' ');
    }
  } catch (error) {
    console.log('YouTube HTML fetch failed:', error);
  }
  return null;
}

// Metod 3: RapidAPI fallback (kräver API-nyckel)
async function fetchFromRapidApi(videoId: string): Promise<string | null> {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) {
    return null;
  }

  try {
    const response = await fetch(
      `https://youtube-transcriptor.p.rapidapi.com/transcript?video_id=${videoId}&lang=en`,
      {
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': 'youtube-transcriptor.p.rapidapi.com',
        },
      }
    );

    const data = await response.json();
    
    if (data && Array.isArray(data) && data.length > 0) {
      // RapidAPI returnerar array av segment
      const transcript = data
        .map((segment: { text?: string }) => segment.text || '')
        .filter(Boolean)
        .join(' ');
      
      if (transcript.length > 0) {
        return transcript;
      }
    }
  } catch (error) {
    console.log('RapidAPI fetch failed:', error);
  }
  return null;
}

export async function fetchTranscript(videoId: string): Promise<string> {
  // Prova alla metoder i ordning
  
  // 1. youtube-transcript paketet
  let transcript = await fetchWithYoutubeTranscript(videoId);
  if (transcript && transcript.length > 50) {
    console.log('Success with youtube-transcript package');
    return transcript;
  }

  // 2. Direkt från YouTube HTML
  transcript = await fetchFromYouTubeHtml(videoId);
  if (transcript && transcript.length > 50) {
    console.log('Success with YouTube HTML fetch');
    return transcript;
  }

  // 3. RapidAPI fallback
  transcript = await fetchFromRapidApi(videoId);
  if (transcript && transcript.length > 50) {
    console.log('Success with RapidAPI');
    return transcript;
  }

  throw new Error('Could not fetch transcript with any method');
}

export async function fetchVideoTitle(videoId: string): Promise<string> {
  try {
    const response = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
    );
    const data = await response.json();
    return data.title || `Video ${videoId}`;
  } catch {
    return `Video ${videoId}`;
  }
}
