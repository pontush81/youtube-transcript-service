import type { TranscriptData } from './tabs/TranscriptTab';
import type { ChatMessage } from './tabs/ChatTab';

type Tab = 'transcript' | 'summary' | 'chat';

interface Props {
  videoId: string;
  activeTab: Tab;
  transcriptData: TranscriptData | null;
  summaryText: string | null;
  chatMessages: ChatMessage[];
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

function generateTranscriptMd(data: TranscriptData, videoId: string): string {
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

function generateTranscriptTxt(data: TranscriptData): string {
  return data.segments.map((seg) => `${seg.timestamp} ${seg.text}`).join('\n');
}

function generateSummaryMd(summary: string, title: string, videoId: string): string {
  return [
    `# Summary: ${title}`,
    '',
    `**Video:** https://www.youtube.com/watch?v=${videoId}`,
    `**Generated:** ${new Date().toISOString().split('T')[0]}`,
    '',
    '---',
    '',
    summary,
  ].join('\n');
}

function generateChatMd(messages: ChatMessage[], title: string, videoId: string): string {
  const lines = [
    `# Chat: ${title}`,
    '',
    `**Video:** https://www.youtube.com/watch?v=${videoId}`,
    `**Exported:** ${new Date().toISOString().split('T')[0]}`,
    '',
    '---',
    '',
  ];
  for (const msg of messages) {
    lines.push(`**${msg.role === 'user' ? 'You' : 'AI'}:** ${msg.content}`);
    lines.push('');
  }
  return lines.join('\n');
}

function generateChatTxt(messages: ChatMessage[]): string {
  return messages
    .map((msg) => `${msg.role === 'user' ? 'You' : 'AI'}: ${msg.content}`)
    .join('\n\n');
}

export function DownloadBar({ videoId, activeTab, transcriptData, summaryText, chatMessages }: Props) {
  const hasContent =
    (activeTab === 'transcript' && transcriptData) ||
    (activeTab === 'summary' && summaryText) ||
    (activeTab === 'chat' && chatMessages.length > 0);

  if (!hasContent) return null;

  const title = transcriptData?.title || 'video';
  const baseName = sanitizeFilename(title);

  function handleDownloadMd() {
    if (activeTab === 'transcript' && transcriptData) {
      downloadFile(generateTranscriptMd(transcriptData, videoId), `${baseName}.md`);
    } else if (activeTab === 'summary' && summaryText) {
      downloadFile(generateSummaryMd(summaryText, title, videoId), `${baseName}-summary.md`);
    } else if (activeTab === 'chat' && chatMessages.length > 0) {
      downloadFile(generateChatMd(chatMessages, title, videoId), `${baseName}-chat.md`);
    }
  }

  function handleDownloadTxt() {
    if (activeTab === 'transcript' && transcriptData) {
      downloadFile(generateTranscriptTxt(transcriptData), `${baseName}.txt`);
    } else if (activeTab === 'summary' && summaryText) {
      downloadFile(summaryText, `${baseName}-summary.txt`);
    } else if (activeTab === 'chat' && chatMessages.length > 0) {
      downloadFile(generateChatTxt(chatMessages), `${baseName}-chat.txt`);
    }
  }

  const label =
    activeTab === 'transcript' ? 'transcript' :
    activeTab === 'summary' ? 'summary' : 'chat';

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
        Download {label} .md
      </button>
      <button onClick={handleDownloadTxt} style={buttonStyle}>
        Download {label} .txt
      </button>
    </div>
  );
}
