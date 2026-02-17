import { useState, useRef, useEffect } from 'preact/hooks';
import type { AuthState } from '../../../lib/auth';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  videoId: string;
  auth: AuthState;
}

const SUGGESTED_QUESTIONS = [
  'Summarize the key points',
  'What are the action items?',
  'Explain the main argument',
];

export function ChatTab({ videoId, auth }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

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
            token: auth.token,
          },
          resolve,
        );
      });

      if (response.success) {
        setMessages((prev) => [...prev, { role: 'assistant', content: response.response }]);
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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  // --- Not signed in ---
  if (!auth.isSignedIn) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
          padding: '32px 16px',
          textAlign: 'center',
          fontFamily: 'Roboto, Arial, sans-serif',
        }}
      >
        <p
          style={{
            fontSize: '14px',
            color: 'var(--text-primary)',
            margin: 0,
            fontWeight: 500,
          }}
        >
          Chat with this video
        </p>
        <p
          style={{
            fontSize: '12px',
            color: 'var(--text-secondary)',
            margin: 0,
          }}
        >
          Ask questions, get summaries, and explore the content
        </p>
        <button
          onClick={() => {
            chrome.runtime.sendMessage({ type: 'OPEN_POPUP' });
          }}
          style={{
            marginTop: '4px',
            padding: '8px 20px',
            fontSize: '13px',
            fontWeight: 500,
            fontFamily: 'Roboto, Arial, sans-serif',
            color: '#ffffff',
            background: 'var(--accent)',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        >
          Sign in to start
        </button>
      </div>
    );
  }

  // --- Signed in ---
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

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
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
