'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { TranscriptListSkeleton } from '@/components/Skeleton';
import { useTranscripts, TranscriptItem, Channel, Category, formatDuration, formatViewCount } from '@/lib/hooks/useTranscripts';

type SortOption = 'uploadedAt' | 'duration' | 'views' | 'published' | 'title';

export default function TranscriptsPage() {
  const [showMyOnly, setShowMyOnly] = useState(false);
  const [channelFilter, setChannelFilter] = useState<string | undefined>();
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>();
  const [sortBy, setSortBy] = useState<SortOption>('uploadedAt');
  const [searchQuery, setSearchQuery] = useState('');

  const {
    transcripts,
    channels,
    categories,
    isLoading: loading,
    error,
    isAuthenticated,
    userTranscriptCount,
    mutate
  } = useTranscripts({ myOnly: showMyOnly, channelId: channelFilter, categoryId: categoryFilter, sortBy });

  // Selection and delete state
  const [editMode, setEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [adminKey, setAdminKey] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteResults, setDeleteResults] = useState<Array<{videoId: string; success: boolean; error?: string}> | null>(null);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Filter transcripts by search query
  const filteredTranscripts = transcripts.filter((transcript) =>
    transcript.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    transcript.channelName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    transcript.categoryName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleSelection = (videoId: string) => {
    setSelectedIds(prev => {
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
    setSelectedIds(new Set(filteredTranscripts.map(t => t.videoId)));
  };

  const selectNone = () => {
    setSelectedIds(new Set());
  };

  const selectOwn = () => {
    setSelectedIds(new Set(filteredTranscripts.filter(t => t.isOwner).map(t => t.videoId)));
  };

  const selectedTranscripts = filteredTranscripts.filter(t => selectedIds.has(t.videoId));
  const allSelectedAreOwned = selectedTranscripts.every(t => t.isOwner);
  const someSelectedNotOwned = selectedTranscripts.some(t => !t.isOwner);

  const handleDelete = async () => {
    if (selectedIds.size === 0) return;

    if (someSelectedNotOwned && !adminKey) {
      setDeleteError('Admin key required to delete others\' transcripts');
      return;
    }

    setDeleting(true);
    setDeleteError(null);
    setDeleteResults(null);

    try {
      const response = await fetch('/api/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoIds: Array.from(selectedIds),
          adminKey: adminKey || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Deletion failed');
      }

      setDeleteResults(data.results);

      const successfulIds = new Set<string>(
        data.results.filter((r: {success: boolean}) => r.success).map((r: {videoId: string}) => r.videoId)
      );
      setSelectedIds(prev => {
        const newSet = new Set(prev);
        successfulIds.forEach((id: string) => newSet.delete(id));
        return newSet;
      });

      mutate();

      if (data.summary.failed === 0) {
        setTimeout(() => {
          setShowDeleteModal(false);
          setDeleteResults(null);
          setAdminKey('');
          if (selectedIds.size === 0) {
            setEditMode(false);
          }
        }, 1500);
      }
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setDeleting(false);
    }
  };

  const cancelEditMode = () => {
    setEditMode(false);
    setSelectedIds(new Set());
  };

  const sortOptions: { value: SortOption; label: string }[] = [
    { value: 'uploadedAt', label: 'Recently added' },
    { value: 'published', label: 'Published date' },
    { value: 'duration', label: 'Duration' },
    { value: 'views', label: 'Views' },
    { value: 'title', label: 'Title A-Z' },
  ];

  return (
    <main className="py-4 sm:py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              Saved Transcripts
            </h1>
            <p className="text-gray-600 text-sm hidden sm:block">
              {transcripts.length} transcripts from {channels.length} channels in {categories.length} categories
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!editMode && transcripts.length > 0 && (
              <button
                onClick={() => setEditMode(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-gray-600 hover:text-gray-900 text-sm font-medium rounded-lg hover:bg-gray-100 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span className="hidden sm:inline">Edit</span>
              </button>
            )}
            {editMode && (
              <button
                onClick={cancelEditMode}
                className="flex items-center gap-1.5 px-3 py-2 text-gray-600 hover:text-gray-900 text-sm font-medium rounded-lg hover:bg-gray-100 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span className="hidden sm:inline">Cancel</span>
              </button>
            )}
            <Link
              href="/chat"
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span className="hidden sm:inline">Chat</span>
            </Link>
          </div>
        </div>

        {/* Edit mode toolbar */}
        {editMode && filteredTranscripts.length > 0 && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">
                  {selectedIds.size} selected
                </span>
                <div className="flex gap-2 text-sm">
                  <button onClick={selectAll} className="text-blue-600 hover:text-blue-800">
                    All
                  </button>
                  <span className="text-gray-300">|</span>
                  <button onClick={selectNone} className="text-blue-600 hover:text-blue-800">
                    None
                  </button>
                  {userTranscriptCount > 0 && (
                    <>
                      <span className="text-gray-300">|</span>
                      <button onClick={selectOwn} className="text-blue-600 hover:text-blue-800">
                        Mine
                      </button>
                    </>
                  )}
                </div>
              </div>
              <button
                onClick={() => setShowDeleteModal(true)}
                disabled={selectedIds.size === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete ({selectedIds.size})
              </button>
            </div>
          </div>
        )}

        {/* Filters row */}
        {!loading && transcripts.length > 0 && (
          <div className="mb-4 space-y-3">
            {/* Filter tabs */}
            <div className="flex flex-wrap gap-2">
              {isAuthenticated && userTranscriptCount > 0 && (
                <>
                  <button
                    onClick={() => setShowMyOnly(false)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                      !showMyOnly
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setShowMyOnly(true)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                      showMyOnly
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Mine
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      showMyOnly ? 'bg-blue-200' : 'bg-gray-200'
                    }`}>
                      {userTranscriptCount}
                    </span>
                  </button>
                </>
              )}

              {/* Channel filter */}
              {channels.length > 1 && (
                <select
                  value={channelFilter || ''}
                  onChange={(e) => setChannelFilter(e.target.value || undefined)}
                  className="px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 border-0 cursor-pointer focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All channels</option>
                  {channels.map((channel) => (
                    <option key={channel.channelId} value={channel.channelId}>
                      {channel.channelName} ({channel.videoCount})
                    </option>
                  ))}
                </select>
              )}

              {/* Category filter */}
              {categories.length > 1 && (
                <select
                  value={categoryFilter || ''}
                  onChange={(e) => setCategoryFilter(e.target.value || undefined)}
                  className="px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 border-0 cursor-pointer focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All categories</option>
                  {categories.map((category) => (
                    <option key={category.categoryId} value={category.categoryId.toString()}>
                      {category.categoryName} ({category.videoCount})
                    </option>
                  ))}
                </select>
              )}

              {/* Sort */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 border-0 cursor-pointer focus:ring-2 focus:ring-blue-500"
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Search */}
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search title or channel..."
                className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-4">
              <TranscriptListSkeleton />
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <p className="text-red-600 mb-4">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="text-blue-600 hover:text-blue-800 underline"
              >
                Try again
              </button>
            </div>
          ) : transcripts.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500 mb-4">No transcripts saved yet.</p>
              <Link
                href="/"
                className="text-blue-600 hover:text-blue-800 underline"
              >
                Fetch your first transcript
              </Link>
            </div>
          ) : filteredTranscripts.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500 mb-2">No transcripts match &quot;{searchQuery}&quot;</p>
              <button
                onClick={() => setSearchQuery('')}
                className="text-blue-600 hover:text-blue-800 underline text-sm"
              >
                Clear search
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {filteredTranscripts.map((transcript) => (
                <TranscriptRow
                  key={transcript.videoId}
                  transcript={transcript}
                  editMode={editMode}
                  isSelected={selectedIds.has(transcript.videoId)}
                  onToggleSelect={() => toggleSelection(transcript.videoId)}
                  formatDate={formatDate}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              Delete {selectedIds.size} transcripts
            </h3>

            {!deleteResults && (
              <>
                <p className="text-gray-600 mb-4">
                  {allSelectedAreOwned
                    ? 'Are you sure you want to delete these transcripts? This cannot be undone.'
                    : 'Some of the selected transcripts are not yours. Enter admin key to delete them.'}
                </p>

                {someSelectedNotOwned && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Admin key
                    </label>
                    <input
                      type="password"
                      value={adminKey}
                      onChange={(e) => setAdminKey(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      placeholder="Required to delete others' transcripts"
                    />
                  </div>
                )}
              </>
            )}

            {deleteResults && (
              <div className="mb-4">
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {deleteResults.map((result) => (
                    <div
                      key={result.videoId}
                      className={`flex items-center gap-2 text-sm ${
                        result.success ? 'text-green-700' : 'text-red-700'
                      }`}
                    >
                      {result.success ? (
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                      <span className="truncate">
                        {result.videoId}
                        {result.error && `: ${result.error}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {deleteError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {deleteError}
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setAdminKey('');
                  setDeleteError(null);
                  setDeleteResults(null);
                }}
                className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium"
              >
                {deleteResults ? 'Close' : 'Cancel'}
              </button>
              {!deleteResults && (
                <button
                  onClick={handleDelete}
                  disabled={deleting || (someSelectedNotOwned && !adminKey)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// Transcript row component with thumbnail
function TranscriptRow({
  transcript,
  editMode,
  isSelected,
  onToggleSelect,
  formatDate,
}: {
  transcript: TranscriptItem;
  editMode: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  formatDate: (date: string) => string;
}) {
  const content = (
    <>
      {editMode && (
        <div className="flex-shrink-0">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            onClick={(e) => e.stopPropagation()}
            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          />
        </div>
      )}

      {/* Thumbnail */}
      <div className="flex-shrink-0 w-24 sm:w-32 aspect-video bg-gray-200 rounded-lg overflow-hidden relative">
        {transcript.thumbnailUrl ? (
          <Image
            src={transcript.thumbnailUrl}
            alt=""
            fill
            sizes="(max-width: 640px) 96px, 128px"
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-100">
            <svg
              className="w-8 h-8 text-gray-400"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" />
            </svg>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <p className="font-medium text-gray-900 text-sm sm:text-base line-clamp-2">
            {transcript.title}
          </p>
          {transcript.isOwner && (
            <span className="flex-shrink-0 text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full">
              Mine
            </span>
          )}
        </div>

        {/* Channel name */}
        {transcript.channelName && (
          <p className="text-sm text-gray-600 mt-0.5 truncate">
            {transcript.channelName}
          </p>
        )}

        {/* Meta info */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500 mt-1">
          {transcript.durationSeconds && (
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {formatDuration(transcript.durationSeconds)}
            </span>
          )}
          {transcript.viewCount && (
            <span className="hidden sm:flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              {formatViewCount(transcript.viewCount)}
            </span>
          )}
          <span className="text-gray-300 hidden sm:inline">·</span>
          <span>{formatDate(transcript.uploadedAt)}</span>
        </div>
      </div>

      <svg
        className="h-5 w-5 text-gray-400 flex-shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </>
  );

  if (editMode) {
    return (
      <li
        onClick={onToggleSelect}
        className={`flex items-center gap-3 p-3 hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer ${
          isSelected ? 'bg-blue-50' : ''
        }`}
      >
        {content}
      </li>
    );
  }

  return (
    <li>
      <Link
        href={`/transcripts/${transcript.videoId}`}
        className="flex items-center gap-3 p-3 hover:bg-gray-50 active:bg-gray-100 transition-colors"
      >
        {content}
      </Link>
    </li>
  );
}
