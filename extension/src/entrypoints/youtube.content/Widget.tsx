import { useState, useEffect, useCallback } from 'preact/hooks';
import { TranscriptTab, type TranscriptData } from './tabs/TranscriptTab';
import { SummaryTab } from './tabs/SummaryTab';
import { ChatTab, type ChatMessage } from './tabs/ChatTab';
import { DownloadBar } from './DownloadBar';

type WidgetState = 'open' | 'minimized' | 'closed';
type Tab = 'transcript' | 'summary' | 'chat';

const STORAGE_KEY_STATE = 'widgetState';
const STORAGE_KEY_TAB = 'activeTab';

interface Props {
  videoId: string;
  onOpen?: () => void;
  onMinimize?: () => void;
  onClose?: () => void;
}

export function Widget({ videoId, onOpen, onMinimize, onClose }: Props) {
  const [widgetState, setWidgetState] = useState<WidgetState>('open');
  const [activeTab, setActiveTab] = useState<Tab>('transcript');
  const [initialized, setInitialized] = useState(false);
  const [transcriptData, setTranscriptData] = useState<TranscriptData | null>(null);
  const [summaryText, setSummaryText] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  // Load persisted state on mount
  useEffect(() => {
    chrome.storage.local.get([STORAGE_KEY_STATE, STORAGE_KEY_TAB], (result) => {
      const persisted = result[STORAGE_KEY_STATE] as WidgetState | undefined;
      const persistedTab = result[STORAGE_KEY_TAB] as Tab | undefined;

      if (persisted && ['open', 'minimized', 'closed'].includes(persisted)) {
        setWidgetState(persisted);
      }
      if (persistedTab && ['transcript', 'summary', 'chat'].includes(persistedTab)) {
        setActiveTab(persistedTab);
      }

      setInitialized(true);
    });
  }, []);

  // Fire callbacks when initialized and state is known
  useEffect(() => {
    if (!initialized) return;

    if (widgetState === 'open') onOpen?.();
    else if (widgetState === 'minimized') onMinimize?.();
    else if (widgetState === 'closed') onClose?.();
  }, [initialized, widgetState]);

  // Persist active tab
  useEffect(() => {
    if (!initialized) return;
    chrome.storage.local.set({ [STORAGE_KEY_TAB]: activeTab });
  }, [activeTab, initialized]);

  const changeState = useCallback((newState: WidgetState) => {
    setWidgetState(newState);
    chrome.storage.local.set({ [STORAGE_KEY_STATE]: newState });
  }, []);

  // Don't render anything until we've loaded persisted state
  if (!initialized) return null;

  // Closed: render nothing
  if (widgetState === 'closed') return null;

  // Minimized: slim bar
  if (widgetState === 'minimized') {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          marginBottom: '12px',
          backgroundColor: 'var(--bg-primary)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          cursor: 'pointer',
          fontFamily: 'Roboto, Arial, sans-serif',
          fontSize: '13px',
          fontWeight: 500,
          color: 'var(--text-primary)',
          userSelect: 'none',
        }}
        onClick={() => changeState('open')}
        title="Expand Transcript Tool"
      >
        <span style={{ color: 'var(--accent)', fontSize: '12px' }}>&#9654;</span>
        <span>Transcript Tool</span>
      </div>
    );
  }

  // Open: full widget
  const tabs: { key: Tab; label: string }[] = [
    { key: 'transcript', label: 'Transcript' },
    { key: 'summary', label: 'Summary' },
    { key: 'chat', label: 'Chat' },
  ];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 100px)',
        marginBottom: '12px',
        backgroundColor: 'var(--bg-primary)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        fontFamily: 'Roboto, Arial, sans-serif',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}
        >
          Transcript Tool
        </span>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={() => changeState('minimized')}
            title="Minimize"
            style={{
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              borderRadius: '8px',
              backgroundColor: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: '16px',
              cursor: 'pointer',
              lineHeight: 1,
              fontFamily: 'Roboto, Arial, sans-serif',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-hover)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
            }}
          >
            &#8722;
          </button>
          <button
            onClick={() => changeState('closed')}
            title="Close"
            style={{
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              borderRadius: '8px',
              backgroundColor: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: '16px',
              cursor: 'pointer',
              lineHeight: 1,
              fontFamily: 'Roboto, Arial, sans-serif',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-hover)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
            }}
          >
            &#10005;
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1,
              padding: '10px 12px',
              border: 'none',
              borderBottom: activeTab === tab.key ? '2px solid var(--accent)' : '2px solid transparent',
              backgroundColor: 'transparent',
              color: activeTab === tab.key ? 'var(--accent)' : 'var(--text-secondary)',
              fontSize: '12px',
              fontWeight: activeTab === tab.key ? 600 : 400,
              cursor: 'pointer',
              fontFamily: 'Roboto, Arial, sans-serif',
              transition: 'color 0.15s, border-color 0.15s',
            }}
            onMouseEnter={(e) => {
              if (activeTab !== tab.key) {
                (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== tab.key) {
                (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
              }
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Scrollable content area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          minHeight: 0,
        }}
      >
        {activeTab === 'transcript' && <TranscriptTab videoId={videoId} onTranscriptLoaded={setTranscriptData} />}
        {activeTab === 'summary' && <SummaryTab videoId={videoId} onSummaryLoaded={(s) => setSummaryText(s || null)} />}
        {activeTab === 'chat' && <ChatTab videoId={videoId} onMessagesChanged={setChatMessages} />}
      </div>

      {/* Download bar (context-aware based on active tab) */}
      <DownloadBar
        videoId={videoId}
        activeTab={activeTab}
        transcriptData={transcriptData}
        summaryText={summaryText}
        chatMessages={chatMessages}
      />
    </div>
  );
}
