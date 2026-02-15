import { useState } from 'preact/hooks';
import type { AuthState } from '../../../lib/auth';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  videoId: string;
  auth: AuthState;
}

export function ChatTab({ videoId, auth }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  if (!auth.isSignedIn) {
    return (
      <div class="flex flex-col items-center gap-2 px-4 py-8 text-center">
        <p class="text-sm text-gray-600">Sign in to chat with this video</p>
        <p class="text-xs text-gray-400">Open the extension popup to sign in</p>
      </div>
    );
  }

  if (!auth.isPro) {
    return (
      <div class="flex flex-col items-center gap-2 px-4 py-8 text-center">
        <p class="text-sm text-gray-600">Chat is a Pro feature</p>
        <p class="text-xs text-gray-400">$5/month -- save and chat unlimited</p>
        <button class="mt-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
          Upgrade to Pro
        </button>
      </div>
    );
  }

  async function sendMessage() {
    if (!input.trim() || loading) return;

    const userMessage: ChatMessage = { role: 'user', content: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await new Promise<any>((resolve) => {
        chrome.runtime.sendMessage(
          {
            type: 'CHAT',
            videoId,
            message: userMessage.content,
            history: messages,
            token: auth.token,
          },
          resolve,
        );
      });

      if (response.success) {
        setMessages((prev) => [...prev, { role: 'assistant', content: response.response }]);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  return (
    <div class="flex h-80 flex-col">
      {/* Messages */}
      <div class="flex-1 overflow-y-auto px-3 py-2">
        {messages.length === 0 && (
          <p class="py-4 text-center text-xs text-gray-400">Ask anything about this video</p>
        )}
        {messages.map((msg, i) => (
          <div key={i} class={`mb-2 text-sm ${msg.role === 'user' ? 'text-right' : ''}`}>
            <span
              class={`inline-block max-w-[85%] rounded-lg px-3 py-2 ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              {msg.content}
            </span>
          </div>
        ))}
        {loading && (
          <div class="mb-2 text-sm">
            <span class="inline-block rounded-lg bg-gray-100 px-3 py-2 text-gray-400">
              Thinking...
            </span>
          </div>
        )}
      </div>

      {/* Input */}
      <div class="border-t border-gray-100 px-3 py-2">
        <div class="flex gap-2">
          <input
            type="text"
            value={input}
            onInput={(e) => setInput((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Ask a question..."
            class="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            class="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
