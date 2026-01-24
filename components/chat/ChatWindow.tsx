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
  const [showMobileSelector, setShowMobileSelector] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

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

  // Count selected videos for mobile button
  const selectedCount = selectedVideos === 'all'
    ? videos.length
    : selectedVideos.length;

  return (
    <div className="flex h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Sidebar - Video selector (desktop) */}
      <div className="w-64 lg:w-72 flex-shrink-0 hidden md:block">
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

      {/* Mobile video selector drawer */}
      {showMobileSelector && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowMobileSelector(false)}
          />
          {/* Drawer */}
          <div className="absolute left-0 top-0 bottom-0 w-80 max-w-[85vw] bg-white shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">Select videos</h2>
              <button
                onClick={() => setShowMobileSelector(false)}
                className="p-2 text-gray-500 hover:text-gray-700"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="h-[calc(100%-4rem)] overflow-y-auto">
              <VideoSelector
                videos={videos}
                selectedVideos={selectedVideos}
                onChange={setSelectedVideos}
              />
            </div>
          </div>
        </div>
      )}

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between p-2 sm:p-3 border-b border-gray-200 gap-2">
          {/* Mobile video selector button */}
          <button
            onClick={() => setShowMobileSelector(true)}
            className="md:hidden flex items-center gap-1.5 px-2.5 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span className="font-medium">{selectedCount}</span>
          </button>

          <div className="flex items-center gap-2 ml-auto">
            <ModeToggle mode={mode} onChange={setMode} />
            {messages.length > 0 && (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                title="Clear chat"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
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

      {/* Clear chat confirmation dialog */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Clear chat?
            </h3>
            <p className="text-gray-600 mb-4">
              All messages will be deleted. This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  clearMessages();
                  setShowClearConfirm(false);
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
