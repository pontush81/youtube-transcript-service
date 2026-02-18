import { useState, useRef, useEffect } from 'preact/hooks';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  videoId: string;
  onMessagesChanged?: (messages: ChatMessage[]) => void;
}

const SUGGESTED_QUESTIONS = [
  'Summarize the key points',
  'What are the action items?',
  'Explain the main argument',
];

/** Stop keyboard events from reaching YouTube's shortcut handlers */
function stopYouTubeShortcuts(e: Event) {
  e.stopPropagation();
}

export function ChatTab({ videoId, onMessagesChanged }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [upgradePrompt, setUpgradePrompt] = useState<string | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages, loading]);

  // Notify parent of message changes
  useEffect(() => {
    if (messages.length > 0) onMessagesChanged?.(messages);
  }, [messages]);

  async function sendMessage(text?: string) {
    const messageText = text ?? input.trim();
    if (!messageText || loading) return;

    const userMessage: ChatMessage = { role: 'user', content: messageText };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await new Promise<any>((resolve) => {
        chrome.runtime.sendMessage(
          {
            type: 'CHAT',
            videoId,
            message: messageText,
            history: messages,
            token: null,
          },
          resolve,
        );
      });

      if (response.success) {
        setMessages((prev) => [...prev, { role: 'assistant', content: response.response }]);
      } else if (response.upgrade) {
        setUpgradePrompt(response.error || 'Daily chat limit reached. Upgrade to Pro for unlimited chat.');
      } else {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `Error: ${response.error || 'Something went wrong. Try again.'}` },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Error: Could not reach the server. Try again.' },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    e.stopPropagation();
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        fontFamily: 'Roboto, Arial, sans-serif',
      }}
    >
      {/* Messages area */}
      <div
        ref={messagesContainerRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px',
        }}
      >
        {/* Empty state with suggested questions */}
        {messages.length === 0 && !loading && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
              padding: '24px 8px',
            }}
          >
            <p
              style={{
                fontSize: '14px',
                color: 'var(--text-secondary)',
                margin: 0,
                textAlign: 'center',
              }}
            >
              Ask anything about this video
            </p>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                width: '100%',
              }}
            >
              {SUGGESTED_QUESTIONS.map((question) => (
                <button
                  key={question}
                  onClick={() => sendMessage(question)}
                  style={{
                    padding: '10px 14px',
                    fontSize: '13px',
                    fontFamily: 'Roboto, Arial, sans-serif',
                    color: 'var(--text-primary)',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    lineHeight: '1.4',
                  }}
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message bubbles */}
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              marginBottom: '8px',
            }}
          >
            <div
              style={{
                maxWidth: '85%',
                padding: '8px 12px',
                fontSize: '13px',
                lineHeight: '1.5',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                background:
                  msg.role === 'user' ? 'var(--bubble-user)' : 'var(--bubble-ai)',
                color:
                  msg.role === 'user'
                    ? 'var(--bubble-user-text)'
                    : 'var(--bubble-ai-text)',
                borderRadius:
                  msg.role === 'user'
                    ? '12px 12px 2px 12px'
                    : '12px 12px 12px 2px',
              }}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {/* Thinking indicator */}
        {loading && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-start',
              marginBottom: '8px',
            }}
          >
            <div
              style={{
                padding: '8px 12px',
                fontSize: '13px',
                lineHeight: '1.5',
                background: 'var(--bubble-ai)',
                color: 'var(--text-secondary)',
                borderRadius: '12px 12px 12px 2px',
              }}
            >
              Thinking...
            </div>
          </div>
        )}

        {/* Upgrade prompt */}
        {upgradePrompt && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px',
              padding: '16px',
              textAlign: 'center',
            }}
          >
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
              {upgradePrompt}
            </p>
            <button
              onClick={() => window.open('https://youtube-transcript-service-two.vercel.app/pricing', '_blank')}
              style={{
                padding: '8px 20px',
                fontSize: '13px',
                fontWeight: 500,
                fontFamily: 'Roboto, Arial, sans-serif',
                color: '#ffffff',
                backgroundColor: 'var(--accent)',
                border: 'none',
                borderRadius: '18px',
                cursor: 'pointer',
              }}
            >
              Upgrade to Pro
            </button>
          </div>
        )}

      </div>

      {/* Input bar */}
      <div
        style={{
          flexShrink: 0,
          borderTop: '1px solid var(--border)',
          padding: '8px 12px',
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
        }}
      >
        <input
          type="text"
          value={input}
          onInput={(e) => setInput((e.target as HTMLInputElement).value)}
          onKeyDown={handleKeyDown}
          onKeyUp={stopYouTubeShortcuts}
          onKeyPress={stopYouTubeShortcuts}
          placeholder="Ask a question..."
          style={{
            flex: 1,
            padding: '8px 12px',
            fontSize: '13px',
            fontFamily: 'Roboto, Arial, sans-serif',
            color: 'var(--text-primary)',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            outline: 'none',
          }}
        />
        <button
          onClick={() => sendMessage()}
          disabled={loading || !input.trim()}
          style={{
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 500,
            fontFamily: 'Roboto, Arial, sans-serif',
            color: '#ffffff',
            background: 'var(--accent)',
            border: 'none',
            borderRadius: '8px',
            cursor: loading || !input.trim() ? 'default' : 'pointer',
            opacity: loading || !input.trim() ? 0.5 : 1,
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
