'use client';

import { useState } from 'react';
import Link from 'next/link';
import { TranscriptListSkeleton } from '@/components/Skeleton';
import { useTranscripts } from '@/lib/hooks/useTranscripts';

export default function TranscriptsPage() {
  const [showMyOnly, setShowMyOnly] = useState(false);
  const { transcripts, isLoading: loading, error, isAuthenticated, userTranscriptCount } = useTranscripts(showMyOnly);
  const [searchQuery, setSearchQuery] = useState('');

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Filter transcripts by search query
  const filteredTranscripts = transcripts.filter((transcript) =>
    transcript.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <main className="py-4 sm:py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              Sparade transkript
            </h1>
            <p className="text-gray-600 text-sm hidden sm:block">
              Alla transkript som har hämtats och sparats
            </p>
          </div>
          <Link
            href="/chat"
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span className="hidden sm:inline">Chatta</span>
          </Link>
        </div>

        {/* Filter tabs for authenticated users */}
        {!loading && isAuthenticated && userTranscriptCount > 0 && (
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setShowMyOnly(false)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                !showMyOnly
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Alla transkript
            </button>
            <button
              onClick={() => setShowMyOnly(true)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                showMyOnly
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Mina transkript
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                showMyOnly ? 'bg-blue-200' : 'bg-gray-200'
              }`}>
                {userTranscriptCount}
              </span>
            </button>
          </div>
        )}

        {/* Search input */}
        {!loading && transcripts.length > 0 && (
          <div className="mb-4">
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
                placeholder="Sök transkript..."
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
                Försök igen
              </button>
            </div>
          ) : transcripts.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500 mb-4">Inga transkript sparade än.</p>
              <Link
                href="/"
                className="text-blue-600 hover:text-blue-800 underline"
              >
                Hämta ditt första transkript
              </Link>
            </div>
          ) : filteredTranscripts.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500 mb-2">Inga transkript matchar &quot;{searchQuery}&quot;</p>
              <button
                onClick={() => setSearchQuery('')}
                className="text-blue-600 hover:text-blue-800 underline text-sm"
              >
                Rensa sökning
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {filteredTranscripts.map((transcript, index) => (
                <li key={index}>
                  <Link
                    href={`/transcripts/${transcript.videoId}`}
                    className="flex items-center gap-3 p-3 sm:p-4 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                  >
                    <div className="flex-shrink-0 w-10 h-10 sm:w-11 sm:h-11 bg-red-100 rounded-lg flex items-center justify-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 text-red-600"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900 text-sm sm:text-base line-clamp-2 sm:truncate">
                          {transcript.title}
                        </p>
                        {transcript.isOwner && (
                          <span className="flex-shrink-0 text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full hidden sm:inline">
                            Din
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500 mt-0.5">
                        <span>{formatDate(transcript.uploadedAt)}</span>
                        <span className="text-gray-300">·</span>
                        <span>{formatSize(transcript.size)}</span>
                      </div>
                    </div>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 text-gray-400 flex-shrink-0"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

      </div>
    </main>
  );
}
