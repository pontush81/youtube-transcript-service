'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Source } from './types';

interface SourceListProps {
  sources: Source[];
}

const COLLAPSE_THRESHOLD = 3;

// Convert timestamp string (e.g., "1:23:45" or "5:30") to seconds
function timestampToSeconds(timestamp: string): number {
  const parts = timestamp.split(':').map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return parts[0] || 0;
}

export function SourceList({ sources }: SourceListProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (sources.length === 0) return null;

  const shouldCollapse = sources.length > COLLAPSE_THRESHOLD;
  const visibleSources = shouldCollapse && !isExpanded
    ? sources.slice(0, COLLAPSE_THRESHOLD)
    : sources;
  const hiddenCount = sources.length - COLLAPSE_THRESHOLD;

  return (
    <div className="mt-3 pt-3 border-t border-gray-200">
      <p className="text-xs font-medium text-gray-500 mb-2">
        Källor ({sources.length}):
      </p>
      <ul className="space-y-1">
        {visibleSources.map((source, index) => (
          <li key={index} className="flex items-center gap-1">
            <Link
              href={`/transcripts/${source.videoId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:text-blue-800 hover:underline line-clamp-1"
            >
              {source.title}
            </Link>
            {source.timestamp && (
              <a
                href={`https://www.youtube.com/watch?v=${source.videoId}&t=${timestampToSeconds(source.timestamp)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-gray-500 hover:text-red-600 flex items-center gap-0.5 flex-shrink-0"
                title="Öppna i YouTube vid denna tidpunkt"
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" />
                </svg>
                @ {source.timestamp}
              </a>
            )}
          </li>
        ))}
      </ul>
      {shouldCollapse && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-2 text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
        >
          <svg
            className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          {isExpanded ? 'Visa färre' : `Visa ${hiddenCount} till`}
        </button>
      )}
    </div>
  );
}
