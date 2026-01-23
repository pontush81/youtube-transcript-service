'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface PlaylistVideo {
  videoId: string;
  title: string;
  thumbnail: string;
  position: number;
}

interface PlaylistInfo {
  playlistId: string;
  title: string;
  channelTitle: string;
  videoCount: number;
  thumbnail: string;
  videos: PlaylistVideo[];
}

interface ProcessResult {
  videoId: string;
  title: string;
  success: boolean;
  error?: string;
  downloadUrl?: string;
}

// Simple check if URL contains playlist parameter
function isPlaylistUrl(url: string): boolean {
  return url.includes('list=');
}

export default function TranscriptForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOptional, setShowOptional] = useState(false);

  const [url, setUrl] = useState('');
  const [submitter, setSubmitter] = useState('');
  const [tags, setTags] = useState('');
  const [notes, setNotes] = useState('');

  // Playlist state
  const [isPlaylist, setIsPlaylist] = useState(false);
  const [playlistInfo, setPlaylistInfo] = useState<PlaylistInfo | null>(null);
  const [loadingPlaylist, setLoadingPlaylist] = useState(false);
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set());
  const [processingPlaylist, setProcessingPlaylist] = useState(false);
  const [processResults, setProcessResults] = useState<ProcessResult[] | null>(null);

  // Debounced playlist detection
  const fetchPlaylistInfo = useCallback(async (playlistUrl: string) => {
    setLoadingPlaylist(true);
    setError(null);
    setPlaylistInfo(null);
    setProcessResults(null);

    try {
      const response = await fetch(`/api/playlist?url=${encodeURIComponent(playlistUrl)}`);
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Kunde inte hämta spellistinformation');
        setLoadingPlaylist(false);
        return;
      }

      setPlaylistInfo(data);
      // Select all videos by default
      setSelectedVideos(new Set(data.videos.map((v: PlaylistVideo) => v.videoId)));
    } catch {
      setError('Kunde inte ansluta till servern');
    } finally {
      setLoadingPlaylist(false);
    }
  }, []);

  // Detect playlist URLs
  useEffect(() => {
    const urlIsPlaylist = isPlaylistUrl(url);
    setIsPlaylist(urlIsPlaylist);

    if (urlIsPlaylist && url.length > 20) {
      const timeoutId = setTimeout(() => {
        fetchPlaylistInfo(url);
      }, 500);
      return () => clearTimeout(timeoutId);
    } else {
      setPlaylistInfo(null);
      setSelectedVideos(new Set());
      setProcessResults(null);
    }
  }, [url, fetchPlaylistInfo]);

  const toggleVideoSelection = (videoId: string) => {
    setSelectedVideos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(videoId)) {
        newSet.delete(videoId);
      } else {
        newSet.add(videoId);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    if (playlistInfo) {
      setSelectedVideos(new Set(playlistInfo.videos.map(v => v.videoId)));
    }
  };

  const selectNone = () => {
    setSelectedVideos(new Set());
  };

  async function handlePlaylistSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedVideos.size === 0) {
      setError('Välj minst en video');
      return;
    }

    setProcessingPlaylist(true);
    setError(null);
    setProcessResults(null);

    try {
      const response = await fetch('/api/playlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoIds: Array.from(selectedVideos),
          submitter: submitter || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Ett fel uppstod');
        setProcessingPlaylist(false);
        return;
      }

      setProcessResults(data.results);
    } catch {
      setError('Kunde inte ansluta till servern');
    } finally {
      setProcessingPlaylist(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // If it's a playlist, use playlist handler
    if (isPlaylist && playlistInfo) {
      return handlePlaylistSubmit(e);
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/transcript', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          submitter: submitter || undefined,
          tags: tags ? tags.split(',').map((t) => t.trim()) : undefined,
          notes: notes || undefined,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Ett fel uppstod');
        setIsLoading(false);
        return;
      }

      const params = new URLSearchParams({
        title: data.title,
        downloadUrl: data.downloadUrl,
        preview: data.preview,
        videoId: data.videoId,
      });

      router.push(`/success?${params.toString()}`);
    } catch {
      setError('Kunde inte ansluta till servern');
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
      <div>
        <label
          htmlFor="url"
          className="block text-sm font-medium text-gray-700 mb-1.5 sm:mb-2"
        >
          YouTube URL <span className="text-red-500">*</span>
        </label>
        <input
          type="url"
          id="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=... eller spellista"
          required
          className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
        />
        {isPlaylist && !loadingPlaylist && !playlistInfo && url.length > 10 && (
          <p className="mt-1 text-sm text-blue-600 flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            Spellista upptäckt - laddar...
          </p>
        )}
      </div>

      {/* Loading playlist indicator */}
      {loadingPlaylist && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2">
            <svg className="animate-spin h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-blue-700">Hämtar spellistinformation...</span>
          </div>
        </div>
      )}

      {/* Playlist preview */}
      {playlistInfo && !processResults && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          {/* Playlist header */}
          <div className="bg-gray-50 p-4 border-b border-gray-200">
            <div className="flex items-start gap-3">
              {playlistInfo.thumbnail && (
                <img
                  src={playlistInfo.thumbnail}
                  alt={playlistInfo.title}
                  className="w-20 h-15 object-cover rounded"
                />
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-gray-900 truncate">{playlistInfo.title}</h3>
                <p className="text-sm text-gray-500">{playlistInfo.channelTitle}</p>
                <p className="text-sm text-gray-500">{playlistInfo.videoCount} videor</p>
              </div>
            </div>
          </div>

          {/* Selection controls */}
          <div className="p-3 bg-white border-b border-gray-200 flex items-center justify-between">
            <span className="text-sm text-gray-600">
              {selectedVideos.size} av {playlistInfo.videos.length} valda
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Välj alla
              </button>
              <span className="text-gray-300">|</span>
              <button
                type="button"
                onClick={selectNone}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Avmarkera alla
              </button>
            </div>
          </div>

          {/* Video list */}
          <div className="max-h-64 overflow-y-auto">
            {playlistInfo.videos.map((video) => (
              <label
                key={video.videoId}
                className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
              >
                <input
                  type="checkbox"
                  checked={selectedVideos.has(video.videoId)}
                  onChange={() => toggleVideoSelection(video.videoId)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                {video.thumbnail && (
                  <img
                    src={video.thumbnail}
                    alt={video.title}
                    className="w-16 h-9 object-cover rounded"
                  />
                )}
                <span className="flex-1 text-sm text-gray-700 truncate">{video.title}</span>
              </label>
            ))}
          </div>

          {/* Warning for large selections */}
          {selectedVideos.size > 20 && (
            <div className="p-3 bg-yellow-50 border-t border-yellow-200">
              <p className="text-sm text-yellow-700">
                Max 20 videor åt gången. Välj färre videor.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Process results */}
      {processResults && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50 p-4 border-b border-gray-200">
            <h3 className="font-medium text-gray-900">Resultat</h3>
            <p className="text-sm text-gray-500">
              {processResults.filter(r => r.success).length} av {processResults.length} lyckades
            </p>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {processResults.map((result) => (
              <div
                key={result.videoId}
                className={`flex items-center gap-3 p-3 border-b border-gray-100 last:border-b-0 ${
                  result.success ? 'bg-green-50' : 'bg-red-50'
                }`}
              >
                {result.success ? (
                  <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 truncate">{result.title}</p>
                  {result.error && (
                    <p className="text-xs text-red-600">{result.error}</p>
                  )}
                </div>
                {result.success && result.downloadUrl && (
                  <a
                    href={`/transcripts/${result.videoId}`}
                    className="text-sm text-blue-600 hover:text-blue-800 flex-shrink-0"
                  >
                    Visa
                  </a>
                )}
              </div>
            ))}
          </div>
          <div className="p-3 bg-gray-50 border-t border-gray-200">
            <button
              type="button"
              onClick={() => {
                setProcessResults(null);
                setUrl('');
                setPlaylistInfo(null);
              }}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Transkribera fler videor
            </button>
          </div>
        </div>
      )}

      {/* Collapsible optional fields */}
      {!playlistInfo && (
        <div>
          <button
            type="button"
            onClick={() => setShowOptional(!showOptional)}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            <svg
              className={`w-4 h-4 transition-transform ${showOptional ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Valfria fält (namn, taggar, anteckningar)
          </button>

          {showOptional && (
            <div className="mt-4 space-y-4 pl-1 border-l-2 border-gray-100 ml-2">
              <div className="pl-4">
                <label
                  htmlFor="submitter"
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                >
                  Ditt namn
                </label>
                <input
                  type="text"
                  id="submitter"
                  value={submitter}
                  onChange={(e) => setSubmitter(e.target.value)}
                  placeholder="Pontus"
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                />
              </div>

              <div className="pl-4">
                <label
                  htmlFor="tags"
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                >
                  Taggar (separera med komma)
                </label>
                <input
                  type="text"
                  id="tags"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="musik, tutorial, podcast"
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                />
              </div>

              <div className="pl-4">
                <label
                  htmlFor="notes"
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                >
                  Anteckningar
                </label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Egna anteckningar om videon..."
                  rows={2}
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Submitter field for playlists */}
      {playlistInfo && !processResults && (
        <div>
          <label
            htmlFor="submitter-playlist"
            className="block text-sm font-medium text-gray-700 mb-1.5"
          >
            Ditt namn (valfritt)
          </label>
          <input
            type="text"
            id="submitter-playlist"
            value={submitter}
            onChange={(e) => setSubmitter(e.target.value)}
            placeholder="Pontus"
            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
          />
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* Submit button - hide after processing playlist */}
      {!processResults && (
        <button
          type="submit"
          disabled={isLoading || loadingPlaylist || processingPlaylist || !!(playlistInfo && selectedVideos.size === 0) || !!(playlistInfo && selectedVideos.size > 20)}
          className="w-full py-2.5 sm:py-3 px-6 bg-blue-600 text-white text-sm sm:text-base font-medium rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 disabled:bg-blue-400 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
        >
          {isLoading || processingPlaylist ? (
            <>
              <svg
                className="animate-spin h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              {processingPlaylist
                ? `Bearbetar ${selectedVideos.size} videor...`
                : 'Hämtar transkript...'}
            </>
          ) : playlistInfo ? (
            `Transkribera ${selectedVideos.size} video${selectedVideos.size !== 1 ? 'r' : ''}`
          ) : (
            'Hämta transkript'
          )}
        </button>
      )}
    </form>
  );
}
