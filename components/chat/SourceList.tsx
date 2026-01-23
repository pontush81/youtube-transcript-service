'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Source } from './types';

interface SourceListProps {
  sources: Source[];
}

const COLLAPSE_THRESHOLD = 3;

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
          <li key={index}>
            <Link
              href={`/transcripts/${source.videoId}`}
              className="text-xs text-blue-600 hover:text-blue-800 hover:underline line-clamp-1"
            >
              {source.title}
              {source.timestamp && ` @ ${source.timestamp}`}
            </Link>
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
