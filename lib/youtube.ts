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
