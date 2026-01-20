'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';

export default function TranscriptViewPage() {
  const params = useParams();
  const id = params.id as string;

  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTranscript() {
      try {
        // Hämta URL från API
        const response = await fetch('/api/transcripts');
        if (!response.ok) throw new Error('Kunde inte hämta transkript');

        const data = await response.json();
        const transcript = data.transcripts.find(
          (t: { videoId: string; url: string }) => t.videoId === id
        );

        if (!transcript) {
          throw new Error('Transkriptet hittades inte');
        }

        setBlobUrl(transcript.url);

        // Hämta innehållet
        const contentResponse = await fetch(transcript.url);
        if (!contentResponse.ok) throw new Error('Kunde inte läsa transkriptet');

        const text = await contentResponse.text();
        setContent(text);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ett fel uppstod');
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      fetchTranscript();
    }
  }, [id]);

  return (
    <main className="min-h-screen py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {loading ? (
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 text-center">
            <div className="animate-spin inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mb-4"></div>
            <p className="text-gray-500">Laddar transkript...</p>
          </div>
        ) : error ? (
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <Link
              href="/transcripts"
              className="text-blue-600 hover:text-blue-800 underline"
            >
              Tillbaka till listan
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-6 flex items-center justify-between">
              <Link
                href="/transcripts"
                className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                    clipRule="evenodd"
                  />
                </svg>
                Tillbaka
              </Link>
              {blobUrl && (
                <a
                  href={blobUrl}
                  download
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Ladda ner
                </a>
              )}
            </div>

            <article className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
              <div className="prose prose-gray max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-p:leading-relaxed prose-li:text-gray-700 prose-strong:text-gray-900 prose-a:text-blue-600">
                <ReactMarkdown>{content || ''}</ReactMarkdown>
              </div>
            </article>
          </>
        )}
      </div>
    </main>
  );
}
