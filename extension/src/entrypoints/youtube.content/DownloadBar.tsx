import type { TranscriptData } from './tabs/TranscriptTab';

interface Props {
  videoId: string;
  transcriptData: TranscriptData | null;
}

function sanitizeFilename(title: string): string {
  return title
    .replace(/[^a-zA-Z0-9\u00C0-\u024F\u1E00-\u1EFF .-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)
    .replace(/^-|-$/g, '')
    || 'transcript';
}

function downloadFile(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function generateMarkdown(data: TranscriptData, videoId: string): string {
  const lines = [
    `# ${data.title}`,
    '',
    `**Video:** https://www.youtube.com/watch?v=${videoId}`,
    `**Downloaded:** ${new Date().toISOString().split('T')[0]}`,
    '',
    '---',
    '',
  ];

  for (const seg of data.segments) {
    lines.push(`**${seg.timestamp}** ${seg.text}`);
  }

  return lines.join('\n');
}

function generatePlainText(data: TranscriptData): string {
  return data.segments.map((seg) => `${seg.timestamp} ${seg.text}`).join('\n');
}

export function DownloadBar({ videoId, transcriptData }: Props) {
  if (!transcriptData) {
    return null;
  }

  const baseName = sanitizeFilename(transcriptData.title);

  function handleDownloadMd() {
    const content = generateMarkdown(transcriptData!, videoId);
    downloadFile(content, `${baseName}.md`);
  }

  function handleDownloadTxt() {
    const content = generatePlainText(transcriptData!);
    downloadFile(content, `${baseName}.txt`);
  }

  const buttonStyle: Record<string, string> = {
    flex: '1',
    padding: '8px 12px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '500',
    fontFamily: 'Roboto, sans-serif',
    border: '1px solid var(--border)',
    cursor: 'pointer',
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
  };

  return (
    <div
      style={{
        padding: '10px 16px',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        gap: '8px',
        flexShrink: '0',
      }}
    >
      <button onClick={handleDownloadMd} style={buttonStyle}>
        Download .md
      </button>
      <button onClick={handleDownloadTxt} style={buttonStyle}>
        Download .txt
      </button>
    </div>
  );
}
