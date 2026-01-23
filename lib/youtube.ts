interface SupadataResponse {
  lang: string;
  availableLangs: string[];
  content: Array<{
    text: string;
    offset: number;
    duration: number;
  }>;
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

export function extractPlaylistId(url: string): string | null {
  // Match playlist URLs like:
  // https://www.youtube.com/playlist?list=PLxxxxxx
  // https://www.youtube.com/watch?v=xxx&list=PLxxxxxx
  const patterns = [
    /[?&]list=([^&\n?#]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

export function isPlaylistUrl(url: string): boolean {
  return extractPlaylistId(url) !== null;
}

interface PlaylistMetadata {
  id: string;
  title: string;
  description: string;
  channelId: string;
  channelTitle: string;
  videoCount: number;
  thumbnail: string;
}

interface PlaylistVideo {
  videoId: string;
  title: string;
  thumbnail: string;
  position: number;
}

export async function fetchPlaylistMetadata(playlistId: string): Promise<PlaylistMetadata> {
  const apiKey = process.env.SUPADATA_API_KEY;

  if (!apiKey) {
    throw new Error('SUPADATA_API_KEY är inte konfigurerad');
  }

  const response = await fetch(
    `https://api.supadata.ai/v1/youtube/playlist?id=${playlistId}`,
    {
      headers: {
        'x-api-key': apiKey,
      },
    }
  );

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Spellistan hittades inte');
    }
    throw new Error(`API-fel: ${response.status}`);
  }

  return response.json();
}

export async function fetchPlaylistVideos(playlistId: string): Promise<PlaylistVideo[]> {
  const apiKey = process.env.SUPADATA_API_KEY;

  if (!apiKey) {
    throw new Error('SUPADATA_API_KEY är inte konfigurerad');
  }

  const response = await fetch(
    `https://api.supadata.ai/v1/youtube/playlist/videos?id=${playlistId}`,
    {
      headers: {
        'x-api-key': apiKey,
      },
    }
  );

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Spellistan hittades inte');
    }
    throw new Error(`API-fel: ${response.status}`);
  }

  const data = await response.json();
  return data.videos || data || [];
}

export async function fetchTranscript(videoId: string, preferredLang?: string): Promise<string> {
  const apiKey = process.env.SUPADATA_API_KEY;

  if (!apiKey) {
    throw new Error('SUPADATA_API_KEY är inte konfigurerad');
  }

  // Bygg URL med språkpreferens
  let url = `https://api.supadata.ai/v1/youtube/transcript?videoId=${videoId}`;

  // Prioritera: användarens val -> svenska -> engelska
  const langPriority = preferredLang ? [preferredLang, 'sv', 'en'] : ['sv', 'en'];

  // Första anrop för att se tillgängliga språk
  const response = await fetch(url, {
    headers: {
      'x-api-key': apiKey,
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Videon hittades inte eller saknar transkript');
    }
    if (response.status === 429) {
      throw new Error('API-kvoten är slut för denna månad');
    }
    throw new Error(`API-fel: ${response.status}`);
  }

  const data: SupadataResponse = await response.json();

  if (!data.content || data.content.length === 0) {
    throw new Error('Inget transkript tillgängligt för denna video');
  }

  // Om vi fick ett icke-prefererat språk, försök hämta ett bättre
  const availableLangs = data.availableLangs || [];
  let bestLang = data.lang;

  for (const lang of langPriority) {
    if (availableLangs.includes(lang) && lang !== data.lang) {
      // Hämta med prefererat språk
      const langResponse = await fetch(`${url}&lang=${lang}`, {
        headers: {
          'x-api-key': apiKey,
        },
      });

      if (langResponse.ok) {
        const langData: SupadataResponse = await langResponse.json();
        if (langData.content && langData.content.length > 0) {
          bestLang = lang;
          data.content = langData.content;
          break;
        }
      }
    } else if (lang === data.lang) {
      break; // Vi har redan bästa språket
    }
  }

  // Kombinera alla textsegment
  const transcript = data.content
    .map(segment => segment.text.replace(/\n/g, ' ').trim())
    .filter(Boolean)
    .join(' ');

  if (transcript.length === 0) {
    throw new Error('Transkriptet var tomt');
  }

  console.log(`Transcript fetched in ${bestLang}, ${transcript.length} chars`);
  return transcript;
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

// Video metadata from Supadata API
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
  transcriptLanguage?: string;
}

interface SupadataVideoResponse {
  id: string;
  title: string;
  description?: string;
  duration?: number;
  channel?: {
    id: string;
    name: string;
  };
  thumbnail?: string;
  uploadDate?: string;
  viewCount?: number;
  likeCount?: number;
  tags?: string[];
  transcriptLanguages?: string[];
}

export async function fetchVideoMetadata(videoId: string): Promise<VideoMetadata> {
  const apiKey = process.env.SUPADATA_API_KEY;

  if (!apiKey) {
    throw new Error('SUPADATA_API_KEY är inte konfigurerad');
  }

  const response = await fetch(
    `https://api.supadata.ai/v1/youtube/video?videoId=${videoId}`,
    {
      headers: {
        'x-api-key': apiKey,
      },
    }
  );

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Videon hittades inte');
    }
    throw new Error(`API-fel: ${response.status}`);
  }

  const data: SupadataVideoResponse = await response.json();

  return {
    videoId: data.id || videoId,
    title: data.title || `Video ${videoId}`,
    description: data.description || null,
    durationSeconds: data.duration || null,
    channelId: data.channel?.id || null,
    channelName: data.channel?.name || null,
    thumbnailUrl: data.thumbnail || null,
    publishedAt: data.uploadDate || null,
    viewCount: data.viewCount ?? null,
    likeCount: data.likeCount ?? null,
    tags: data.tags || [],
  };
}

// Fallback to oEmbed if Supadata fails (free, no API key needed)
export async function fetchVideoMetadataFallback(videoId: string): Promise<Partial<VideoMetadata>> {
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
