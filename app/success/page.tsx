'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import DownloadButton from '@/components/DownloadButton';

function SuccessContent() {
  const searchParams = useSearchParams();

  const title = searchParams.get('title') || 'Unknown video';
  const downloadUrl = searchParams.get('downloadUrl') || '';
  const preview = searchParams.get('preview') || '';
  const videoId = searchParams.get('videoId') || '';

  if (!downloadUrl) {
    return (
      <div className="text-center">
        <p className="text-red-600 mb-4">No download link found.</p>
        <Link
          href="/"
          className="text-blue-600 hover:text-blue-800 underline"
        >
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8 text-green-600"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Transcript Created!
        </h1>
        <p className="text-gray-600">{title}</p>
      </div>

      <div className="flex justify-center gap-3">
        <Link
          href={`/transcripts/${videoId}`}
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
          </svg>
          Read Transcript
        </Link>
        <DownloadButton
          url={downloadUrl}
          filename={`${videoId}-transcript.md`}
        />
      </div>

      {preview && (
        <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
          <h2 className="text-sm font-medium text-gray-700 mb-3">
            Preview
          </h2>
          <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap">
            {preview}
          </p>
        </div>
      )}

      <div className="text-center pt-4">
        <Link
          href="/"
          className="text-blue-600 hover:text-blue-800 underline"
        >
          Fetch new transcript
        </Link>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <main className="min-h-screen py-12 px-4">
      <div className="max-w-xl mx-auto">
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
          <Suspense
            fallback={
              <div className="text-center py-8">
                <p className="text-gray-500">Loading...</p>
              </div>
            }
          >
            <SuccessContent />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
