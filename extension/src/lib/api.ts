const API_BASE =
  import.meta.env.VITE_API_BASE_URL || 'https://youtube-transcript-service-two.vercel.app';

const TIMEOUT_MS = 30000;

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

function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

export async function fetchTranscript(url: string, token?: string): Promise<TranscriptResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetchWithTimeout(`${API_BASE}/api/transcript`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ url }),
  });

  if (!res.ok) throw new Error(`Transcript fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchSummary(markdown: string): Promise<{ summary: string }> {
  const res = await fetchWithTimeout(`${API_BASE}/api/summary`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript: markdown }),
  });

  if (!res.ok) throw new Error(`Summary failed: ${res.status}`);
  return res.json();
}

export async function chatWithVideo(
  videoId: string,
  message: string,
  history: ChatMessage[],
  _token: string,
): Promise<string> {
  const res = await fetchWithTimeout(`${API_BASE}/api/chat/extension`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      videoId,
      message,
      conversationHistory: history,
    }),
  });

  if (!res.ok) throw new Error(`Chat failed: ${res.status}`);
  const data = await res.json();
  return data.response;
}
