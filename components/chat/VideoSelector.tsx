'use client';

import { useState } from 'react';
import { VideoOption } from './types';

interface VideoSelectorProps {
  videos: VideoOption[];
  selectedVideos: string[] | 'all';
  onChange: (selection: string[] | 'all') => void;
}

export function VideoSelector({ videos, selectedVideos, onChange }: VideoSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredVideos = videos.filter(v =>
    v.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isAllSelected = selectedVideos === 'all';
  const selectedSet = new Set(isAllSelected ? [] : selectedVideos);

  const handleToggleAll = () => {
    onChange(isAllSelected ? [] : 'all');
  };

  const handleToggleVideo = (videoId: string) => {
    if (isAllSelected) {
      // Switch from "all" to specific selection (all except this one)
      const allExceptThis = videos.map(v => v.videoId).filter(id => id !== videoId);
      onChange(allExceptThis);
    } else if (selectedSet.has(videoId)) {
      // Remove from selection
      const newSelection = [...selectedSet].filter(id => id !== videoId);
      onChange(newSelection);
    } else {
      // Add to selection
      onChange([...selectedSet, videoId]);
    }
  };

  return (
    <div className="h-full flex flex-col border-r border-gray-200">
      <div className="p-4 border-b border-gray-200">
        <h2 className="font-medium text-gray-900 mb-3">Transcripts</h2>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search videos..."
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
        />
      </div>

      <div className="p-2 border-b border-gray-200">
        <label className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer">
          <input
            type="checkbox"
            checked={isAllSelected}
            onChange={handleToggleAll}
            className="w-5 h-5 flex-shrink-0 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
          />
          <span className="text-sm font-medium">
            All ({videos.length})
          </span>
        </label>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {filteredVideos.map((video) => (
          <label
            key={video.videoId}
            className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer"
          >
            <input
              type="checkbox"
              checked={isAllSelected || selectedSet.has(video.videoId)}
              onChange={() => handleToggleVideo(video.videoId)}
              className="w-5 h-5 flex-shrink-0 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            />
            <span className="text-sm truncate" title={video.title}>
              {video.title}
            </span>
          </label>
        ))}

        {filteredVideos.length === 0 && (
          <p className="text-sm text-gray-500 p-2">No videos found</p>
        )}
      </div>
    </div>
  );
}
