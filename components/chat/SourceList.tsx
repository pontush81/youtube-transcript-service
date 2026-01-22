'use client';

import Link from 'next/link';
import { Source } from './types';

interface SourceListProps {
  sources: Source[];
}

export function SourceList({ sources }: SourceListProps) {
  if (sources.length === 0) return null;

  return (
    <div className="mt-3 pt-3 border-t border-gray-200">
      <p className="text-xs font-medium text-gray-500 mb-2">Källor:</p>
      <ul className="space-y-1">
        {sources.map((source, index) => (
          <li key={index}>
            <Link
              href={`/transcripts/${source.videoId}`}
              className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
            >
              {source.title}
              {source.timestamp && ` @ ${source.timestamp}`}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
