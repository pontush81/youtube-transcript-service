import { useState, useEffect } from 'preact/hooks';

interface Props {
  videoId: string;
  onSummaryLoaded?: (summary: string) => void;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderMarkdown(text: string): string {
  const escaped = escapeHtml(text);
  const lines = escaped.split('\n');
  const htmlLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Heading: ## Heading → <h3>
    const headingMatch = line.match(/^#{1,3}\s+(.*)/);
    if (headingMatch) {
      const content = headingMatch[1].replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      htmlLines.push(
        `<h3 style="font-size:15px;font-weight:600;margin:16px 0 8px 0;color:var(--text-primary);line-height:1.4">${content}</h3>`,
      );
      continue;
    }

    // Bullet point: * item or - item
    const bulletMatch = line.match(/^[\*\-]\s+(.*)/);
    if (bulletMatch) {
      const content = bulletMatch[1].replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      htmlLines.push(
        `<div style="display:flex;gap:8px;margin:4px 0;line-height:1.5"><span style="color:var(--text-secondary);flex-shrink:0;margin-top:2px">&#8226;</span><span>${content}</span></div>`,
      );
      continue;
    }

    // Empty line → line break
    if (line.trim() === '') {
      htmlLines.push('<br/>');
      continue;
    }

    // Regular paragraph with bold support
    line = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    htmlLines.push(`<p style="margin:4px 0;line-height:1.5">${line}</p>`);
  }

  return htmlLines.join('');
}

function SkeletonLoader() {
  return (
    <div style={{ padding: '16px' }}>
      {/* Heading placeholder */}
      <div
        class="skeleton"
        style={{ width: '60%', height: '18px', marginBottom: '12px' }}
      />

      {/* Bullet point placeholders */}
      {[1, 2, 3].map((i) => (
        <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <div
            class="skeleton"
            style={{ width: '6px', height: '6px', borderRadius: '50%', marginTop: '7px', flexShrink: 0 }}
          />
          <div
            class="skeleton"
            style={{ width: `${75 - i * 10}%`, height: '14px' }}
          />
        </div>
      ))}

      {/* Second heading placeholder */}
      <div
        class="skeleton"
        style={{ width: '45%', height: '18px', marginTop: '20px', marginBottom: '12px' }}
      />

      {/* Paragraph placeholders */}
      <div
        class="skeleton"
        style={{ width: '100%', height: '14px', marginBottom: '6px' }}
      />
      <div
        class="skeleton"
        style={{ width: '90%', height: '14px', marginBottom: '6px' }}
      />
      <div
        class="skeleton"
        style={{ width: '70%', height: '14px', marginBottom: '16px' }}
      />

      {/* Third heading placeholder */}
      <div
        class="skeleton"
        style={{ width: '55%', height: '18px', marginTop: '20px', marginBottom: '12px' }}
      />

      {/* More bullet placeholders */}
      {[1, 2].map((i) => (
        <div key={`b${i}`} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <div
            class="skeleton"
            style={{ width: '6px', height: '6px', borderRadius: '50%', marginTop: '7px', flexShrink: 0 }}
          />
          <div
            class="skeleton"
            style={{ width: `${80 - i * 15}%`, height: '14px' }}
          />
        </div>
      ))}
    </div>
  );
}

export function SummaryTab({ videoId, onSummaryLoaded }: Props) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check cache on mount
  useEffect(() => {
    chrome.storage.local.get(`summary_${videoId}`, (result) => {
      const cached = result[`summary_${videoId}`];
      if (cached) {
        setSummary(cached);
        onSummaryLoaded?.(cached);
      }
    });
  }, [videoId]);

  async function generateSummary() {
    setLoading(true);
    setError(null);

    try {
      // Step 1: fetch transcript
      const transcriptRes = await new Promise<any>((resolve) => {
        chrome.runtime.sendMessage(
          { type: 'FETCH_TRANSCRIPT', url: `https://www.youtube.com/watch?v=${videoId}` },
          resolve,
        );
      });

      if (!transcriptRes.success) {
        setError(transcriptRes.error || 'Could not fetch transcript');
        setLoading(false);
        return;
      }

      // Step 2: summarize
      const summaryRes = await new Promise<any>((resolve) => {
        chrome.runtime.sendMessage(
          { type: 'SUMMARIZE', markdown: transcriptRes.data.markdown },
          resolve,
        );
      });

      if (summaryRes.success) {
        setSummary(summaryRes.data.summary);
        onSummaryLoaded?.(summaryRes.data.summary);
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

  // Loading state: skeleton loader
  if (loading) {
    return <SkeletonLoader />;
  }

  // Error state with retry
  if (error && !summary) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '10px',
          padding: '32px 16px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: '13px',
            color: 'var(--error)',
            lineHeight: 1.4,
          }}
        >
          {error}
        </div>
        <button
          onClick={generateSummary}
          style={{
            padding: '8px 20px',
            fontSize: '13px',
            fontWeight: 500,
            fontFamily: 'Roboto, Arial, sans-serif',
            color: 'var(--accent)',
            backgroundColor: 'transparent',
            border: '1px solid var(--accent)',
            borderRadius: '18px',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--accent-light)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
          }}
        >
          Try again
        </button>
      </div>
    );
  }

  // CTA state: no summary cached, show button
  if (!summary) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
          padding: '32px 16px',
        }}
      >
        <div
          style={{
            fontSize: '13px',
            color: 'var(--text-secondary)',
            textAlign: 'center',
          }}
        >
          Get an AI-generated summary of this video
        </div>
        <button
          onClick={generateSummary}
          style={{
            padding: '10px 24px',
            fontSize: '14px',
            fontWeight: 500,
            fontFamily: 'Roboto, Arial, sans-serif',
            color: '#ffffff',
            backgroundColor: 'var(--accent)',
            border: 'none',
            borderRadius: '18px',
            cursor: 'pointer',
            transition: 'background-color 0.15s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--accent-hover)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--accent)';
          }}
        >
          Summarize video
        </button>
      </div>
    );
  }

  // Summary rendered
  return (
    <div>
      <div
        style={{
          padding: '12px 16px',
          fontSize: '13px',
          color: 'var(--text-primary)',
          lineHeight: 1.5,
        }}
        dangerouslySetInnerHTML={{ __html: renderMarkdown(summary) }}
      />

      {/* Footer actions */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          padding: '8px 16px',
          borderTop: '1px solid var(--border)',
        }}
      >
        <button
          onClick={() => navigator.clipboard.writeText(summary)}
          style={{
            fontSize: '12px',
            fontFamily: 'Roboto, Arial, sans-serif',
            color: 'var(--text-secondary)',
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '4px 0',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
          }}
        >
          Copy summary
        </button>
        <button
          onClick={() => {
            setSummary(null);
            onSummaryLoaded?.('');
            chrome.storage.local.remove(`summary_${videoId}`);
          }}
          style={{
            fontSize: '12px',
            fontFamily: 'Roboto, Arial, sans-serif',
            color: 'var(--text-secondary)',
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '4px 0',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
          }}
        >
          Regenerate
        </button>
      </div>
    </div>
  );
}
