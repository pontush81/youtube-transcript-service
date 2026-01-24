'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { ChatMessage } from './types';
import { SourceList } from './SourceList';

interface MessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onRegenerate?: (messageId: string) => void;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1.5 rounded hover:bg-gray-200 transition-colors text-gray-500 hover:text-gray-700"
      title="Copy"
    >
      {copied ? (
        <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )}
    </button>
  );
}

export function MessageList({ messages, isLoading, onRegenerate }: MessageListProps) {
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        <div className="text-center">
          <p className="text-lg mb-2">Ask a question about your videos</p>
          <p className="text-sm">Select which transcripts to include in the search</p>
        </div>
      </div>
    );
  }

  // Find the last assistant message for regenerate button
  const lastAssistantIndex = [...messages].reverse().findIndex(m => m.role === 'assistant');
  const lastAssistantId = lastAssistantIndex >= 0
    ? messages[messages.length - 1 - lastAssistantIndex].id
    : null;

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div className={`max-w-[80%] ${message.role === 'assistant' ? 'group' : ''}`}>
            <div
              className={`rounded-lg p-4 ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              {message.role === 'user' ? (
                <p className="whitespace-pre-wrap">{message.content}</p>
              ) : (
                <div className="prose prose-sm max-w-none prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-strong:text-gray-900">
                  <ReactMarkdown>{message.content}</ReactMarkdown>
                </div>
              )}
              {message.role === 'assistant' && message.content === '' && isLoading && (
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
                </div>
              )}
              {message.sources && message.sources.length > 0 && (
                <SourceList sources={message.sources} />
              )}
            </div>

            {/* Action buttons for assistant messages */}
            {message.role === 'assistant' && message.content && (
              <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <CopyButton text={message.content} />
                {onRegenerate && message.id === lastAssistantId && !isLoading && (
                  <button
                    onClick={() => onRegenerate(message.id)}
                    className="p-1.5 rounded hover:bg-gray-200 transition-colors text-gray-500 hover:text-gray-700"
                    title="Regenerate response"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
