import { useState, useEffect, useRef } from 'preact/hooks';

interface TranscriptSegment {
  timestamp: string;
  seconds: number;
  text: string;
}

interface Props {
  videoId: string;
}

function parseTranscriptMarkdown(markdown: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  const lines = markdown.split('\n');

  for (const line of lines) {
    const match = line.match(/\*\*\[(\d{1,2}:\d{2}(?::\d{2})?)\]\*\*\s*(.*)/);
    if (match) {
      const timestamp = match[1];
      const text = match[2];
      const parts = timestamp.split(':').map(Number);
      const seconds =
        parts.length === 3
          ? parts[0] * 3600 + parts[1] * 60 + parts[2]
          : parts[0] * 60 + parts[1];
      segments.push({ timestamp, seconds, text });
    }
  }

  return segments;
}

function seekVideo(seconds: number) {
  const video = document.querySelector('video');
  if (video) {
    video.currentTime = seconds;
    video.play();
  }
}

export function TranscriptTab({ videoId }: Props) {
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [rawMarkdown, setRawMarkdown] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const video = document.querySelector('video');
    if (!video) return;

    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    video.addEventListener('timeupdate', onTimeUpdate);
    return () => video.removeEventListener('timeupdate', onTimeUpdate);
  }, []);

  async function loadTranscript() {
    setLoading(true);
    setError(null);

    try {
      const response = await new Promise<any>((resolve) => {
        chrome.runtime.sendMessage(
          { type: 'FETCH_TRANSCRIPT', url: `https://www.youtube.com/watch?v=${videoId}` },
          resolve,
        );
      });

      if (response.success) {
        setRawMarkdown(response.data.markdown);
        setSegments(parseTranscriptMarkdown(response.data.markdown));
      } else {
        setError(response.error || 'Failed to fetch transcript');
      }
    } catch {
      setError('Communication error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTranscript();
  }, [videoId]);

  function copyTranscript() {
    navigator.clipboard.writeText(rawMarkdown);
  }

  if (loading) {
    return <div class="py-8 text-center text-sm text-gray-500">Loading transcript...</div>;
  }

  if (error) {
    return (
      <div class="py-4 px-4">
        <p class="mb-2 text-sm text-red-600">{error}</p>
        <button onClick={loadTranscript} class="text-sm text-blue-600 hover:underline">
          Try again
        </button>
      </div>
    );
  }

  if (segments.length === 0) {
    return <div class="py-8 text-center text-sm text-gray-500">No transcript available</div>;
  }

  const currentIndex = segments.findLastIndex((s) => s.seconds <= currentTime);

  return (
    <div>
      <div ref={containerRef} class="max-h-96 overflow-y-auto">
        {segments.map((seg, i) => (
          <div
            key={i}
            class={`cursor-pointer border-l-2 px-3 py-2 text-sm hover:bg-gray-50 ${
              i === currentIndex ? 'border-blue-600 bg-blue-50' : 'border-transparent'
            }`}
            onClick={() => seekVideo(seg.seconds)}
          >
            <span class="mr-2 font-mono text-xs text-blue-600">{seg.timestamp}</span>
            <span class="text-gray-700">{seg.text}</span>
          </div>
        ))}
      </div>

      <div class="flex gap-2 border-t border-gray-100 px-3 py-2">
        <button onClick={copyTranscript} class="text-xs text-gray-500 hover:text-gray-700">
          Copy transcript
        </button>
      </div>
    </div>
  );
}
