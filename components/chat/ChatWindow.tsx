'use client';

import { useState, useEffect } from 'react';
import { VideoSelector } from './VideoSelector';
import { ModeToggle } from './ModeToggle';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { useChat } from './useChat';
import { VideoOption } from './types';

export function ChatWindow() {
  const [videos, setVideos] = useState<VideoOption[]>([]);
  const [selectedVideos, setSelectedVideos] = useState<string[] | 'all'>('all');
  const [mode, setMode] = useState<'strict' | 'hybrid'>('strict');
  const [loadingVideos, setLoadingVideos] = useState(true);

  const { messages, isLoading, error, sendMessage, clearMessages } = useChat({
    selectedVideos,
    mode,
  });

  useEffect(() => {
    async function fetchVideos() {
      try {
        const response = await fetch('/api/transcripts');
        if (response.ok) {
          const data = await response.json();
          setVideos(data.transcripts.map((t: { videoId: string; title: string; url: string }) => ({
            videoId: t.videoId,
            title: t.title,
            url: t.url,
          })));
        }
      } catch (err) {
        console.error('Failed to fetch videos:', err);
      } finally {
        setLoadingVideos(false);
      }
    }
    fetchVideos();
  }, []);

  return (
    <div className="flex h-[calc(100vh-8rem)] bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Sidebar - Video selector */}
      <div className="w-72 flex-shrink-0 hidden md:block">
        {loadingVideos ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full" />
          </div>
        ) : (
          <VideoSelector
            videos={videos}
            selectedVideos={selectedVideos}
            onChange={setSelectedVideos}
          />
        )}
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h1 className="font-semibold text-gray-900">Transcript Chat</h1>
          <div className="flex items-center gap-4">
            <ModeToggle mode={mode} onChange={setMode} />
            {messages.length > 0 && (
              <button
                onClick={clearMessages}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Rensa
              </button>
            )}
          </div>
        </div>

        {/* Error display */}
        {error && (
          <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Messages */}
        <MessageList messages={messages} isLoading={isLoading} />

        {/* Input */}
        <MessageInput onSend={sendMessage} disabled={isLoading} />
      </div>
    </div>
  );
}
