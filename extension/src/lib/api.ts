const API_BASE =
  import.meta.env.VITE_API_BASE_URL || 'https://youtube-transcript-service-two.vercel.app';

interface TranscriptResponse {
  markdown: string;
  title: string;
  videoId: string;
  segments?: { text: string; offset: number; duration: number }[];
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function fetchTranscript(url: string, token?: string): Promise<TranscriptResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/api/transcript`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ url }),
  });

  if (!res.ok) throw new Error(`Transcript fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchSummary(markdown: string): Promise<{ summary: string }> {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message:
        'Give me a summary with key takeaways of this transcript. Format: start with "## Key Takeaways" as bullet points, then "## Summary" as a short paragraph.',
      context: markdown,
    }),
  });

  if (!res.ok) throw new Error(`Summary failed: ${res.status}`);
  const data = await res.json();
  return { summary: data.response };
}

export async function saveToLibrary(url: string, token: string): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/api/add`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ url }),
  });

  if (!res.ok) throw new Error(`Save failed: ${res.status}`);
  return res.json();
}

export async function chatWithVideo(
  videoId: string,
  message: string,
  history: ChatMessage[],
  token: string,
): Promise<string> {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ videoId, message, history }),
  });

  if (!res.ok) throw new Error(`Chat failed: ${res.status}`);
  const data = await res.json();
  return data.response;
}
