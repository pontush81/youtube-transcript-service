'use client';

import { useState, useCallback, useRef } from 'react';
import { ChatMessage } from './types';

interface UseChatOptions {
  selectedVideos: string[] | 'all';
  mode: 'strict' | 'hybrid';
}

const MAX_RETRIES = 2;
const RETRY_DELAY = 1000;

export function useChat({ selectedVideos, mode }: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (content: string, retryCount = 0) => {
    if (!content.trim() || (isLoading && retryCount === 0)) return;

    setError(null);
    setIsLoading(true);

    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    // Add user message only on first try
    let assistantMessageId: string;
    if (retryCount === 0) {
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, userMessage]);

      // Prepare assistant message placeholder
      assistantMessageId = crypto.randomUUID();
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        sources: [],
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
    } else {
      // On retry, get the existing assistant message ID
      assistantMessageId = messages[messages.length - 1]?.id || crypto.randomUUID();
      // Reset the assistant message content for retry
      setMessages(prev => prev.map(m =>
        m.id === assistantMessageId
          ? { ...m, content: '', sources: [] }
          : m
      ));
    }

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          conversationHistory: messages.filter(m => m.role !== 'assistant' || m.content).map(m => ({
            role: m.role,
            content: m.content,
          })),
          selectedVideos,
          mode,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        // Handle rate limiting
        if (response.status === 429) {
          const data = await response.json();
          throw new Error(data.error || 'För många förfrågningar');
        }
        throw new Error('Chat request failed');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';
      let receivedContent = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;

          try {
            const data = JSON.parse(line.slice(6));

            if (data.type === 'sources') {
              setMessages(prev => prev.map(m =>
                m.id === assistantMessageId
                  ? { ...m, sources: data.sources }
                  : m
              ));
            } else if (data.type === 'content') {
              receivedContent = true;
              setMessages(prev => prev.map(m =>
                m.id === assistantMessageId
                  ? { ...m, content: m.content + data.content }
                  : m
              ));
            } else if (data.type === 'error') {
              setError(data.error);
            }
          } catch {
            // Ignore parse errors
          }
        }
      }

      // If we didn't receive any content, something went wrong
      if (!receivedContent && retryCount < MAX_RETRIES) {
        console.warn(`No content received, retrying (${retryCount + 1}/${MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        return sendMessage(content, retryCount + 1);
      }
    } catch (err) {
      // Don't retry on abort
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }

      // Retry on network errors
      if (retryCount < MAX_RETRIES && err instanceof TypeError) {
        console.warn(`Network error, retrying (${retryCount + 1}/${MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        return sendMessage(content, retryCount + 1);
      }

      setError(err instanceof Error ? err.message : 'Ett fel uppstod');
      // Remove the empty assistant message on final error
      setMessages(prev => prev.filter(m => m.id !== assistantMessageId || m.content));
    } finally {
      setIsLoading(false);
    }
  }, [messages, selectedVideos, mode, isLoading]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearMessages,
  };
}
