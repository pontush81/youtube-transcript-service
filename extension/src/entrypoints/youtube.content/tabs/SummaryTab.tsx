import { useState, useEffect } from 'preact/hooks';

interface Props {
  videoId: string;
}

export function SummaryTab({ videoId }: Props) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check cache on mount
  useEffect(() => {
    chrome.storage.local.get(`summary_${videoId}`, (result) => {
      const cached = result[`summary_${videoId}`];
      if (cached) setSummary(cached);
    });
  }, [videoId]);

  async function generateSummary() {
    setLoading(true);
    setError(null);

    try {
      // First get the transcript
      const transcriptRes = await new Promise<any>((resolve) => {
        chrome.runtime.sendMessage(
          { type: 'FETCH_TRANSCRIPT', url: `https://www.youtube.com/watch?v=${videoId}` },
          resolve,
        );
      });

      if (!transcriptRes.success) {
        setError('Could not fetch transcript');
        return;
      }

      // Then summarize it
      const summaryRes = await new Promise<any>((resolve) => {
        chrome.runtime.sendMessage(
          { type: 'SUMMARIZE', markdown: transcriptRes.data.markdown },
          resolve,
        );
      });

      if (summaryRes.success) {
        setSummary(summaryRes.data.summary);
        // Cache locally
        chrome.storage.local.set({ [`summary_${videoId}`]: summaryRes.data.summary });
      } else {
        setError(summaryRes.error || 'Summary generation failed');
      }
    } catch {
      setError('Communication error');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div class="py-8 text-center text-sm text-gray-500">Generating summary...</div>;
  }

  if (!summary) {
    return (
      <div class="flex flex-col items-center gap-3 py-8">
        <button
          onClick={generateSummary}
          class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Summarize video
        </button>
        {error && <p class="text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <div class="max-h-96 overflow-y-auto px-4 py-3 text-sm leading-relaxed text-gray-700 whitespace-pre-wrap">
        {summary}
      </div>
      <div class="flex gap-2 border-t border-gray-100 px-3 py-2">
        <button
          onClick={() => navigator.clipboard.writeText(summary)}
          class="text-xs text-gray-500 hover:text-gray-700"
        >
          Copy summary
        </button>
      </div>
    </div>
  );
}
