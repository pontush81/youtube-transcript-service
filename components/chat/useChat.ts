'use client';

import { useState, useCallback } from 'react';
import { ChatMessage } from './types';

interface UseChatOptions {
  selectedVideos: string[] | 'all';
  mode: 'strict' | 'hybrid';
}

export function useChat({ selectedVideos, mode }: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    setError(null);
    setIsLoading(true);

    // Add user message
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    // Prepare assistant message placeholder
    const assistantMessageId = crypto.randomUUID();
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      sources: [],
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, assistantMessage]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          conversationHistory: messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
          selectedVideos,
          mode,
        }),
      });

      if (!response.ok) {
        throw new Error('Chat request failed');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ett fel uppstod');
      // Remove the empty assistant message on error
      setMessages(prev => prev.filter(m => m.id !== assistantMessageId));
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
