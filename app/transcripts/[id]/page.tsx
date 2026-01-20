'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';

export default function TranscriptViewPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [title, setTitle] = useState<string>('');
  const [formatting, setFormatting] = useState(false);
  const [formatError, setFormatError] = useState<string | null>(null);
  const [isFormatted, setIsFormatted] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [adminKey, setAdminKey] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [summarizeError, setSummarizeError] = useState<string | null>(null);
  const [hasSummary, setHasSummary] = useState(false);

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
        setTitle(transcript.title || '');

        // Hämta innehållet
        const contentResponse = await fetch(transcript.url);
        if (!contentResponse.ok) throw new Error('Kunde inte läsa transkriptet');

        const text = await contentResponse.text();
        setContent(text);

        // Kolla om redan AI-formaterad (har rubriker EFTER "## Transkript" eller talare-markeringar)
        const transcriptSection = text.split('## Transkript')[1] || '';
        const hasAIFormatting = transcriptSection.includes('\n## ') || transcriptSection.includes('**Talare');
        setIsFormatted(hasAIFormatting);

        // Kolla om redan har sammanfattning
        setHasSummary(text.includes('## Sammanfattning') || text.includes('## Summary'));
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

  const handleFormat = async () => {
    if (!blobUrl || formatting) return;

    setFormatting(true);
    setFormatError(null);

    try {
      const response = await fetch('/api/format', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blobUrl, title }),
      });

      // Handle non-JSON error responses (e.g., Vercel platform errors)
      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        const text = await response.text();
        throw new Error(text || 'Serverfel vid formatering');
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Formatering misslyckades');
      }

      // Hämta det nya innehållet
      if (data.newUrl) {
        const newContentResponse = await fetch(data.newUrl);
        if (newContentResponse.ok) {
          const newText = await newContentResponse.text();
          setContent(newText);
          setBlobUrl(data.newUrl);
          setIsFormatted(true);
        }
      }
    } catch (err) {
      setFormatError(err instanceof Error ? err.message : 'Ett fel uppstod');
    } finally {
      setFormatting(false);
    }
  };

  const handleDelete = async () => {
    if (!blobUrl || deleting || !adminKey) return;

    setDeleting(true);
    setDeleteError(null);

    try {
      const response = await fetch('/api/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blobUrl, adminKey }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Radering misslyckades');
      }

      // Redirect till listan
      router.push('/transcripts');
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Ett fel uppstod');
      setDeleting(false);
    }
  };

  const handleSummarize = async () => {
    if (!blobUrl || summarizing) return;

    setSummarizing(true);
    setSummarizeError(null);

    try {
      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blobUrl, title }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Sammanfattning misslyckades');
      }

      // Hämta det nya innehållet
      if (data.newUrl) {
        const newContentResponse = await fetch(data.newUrl);
        if (newContentResponse.ok) {
          const newText = await newContentResponse.text();
          setContent(newText);
          setBlobUrl(data.newUrl);
          setHasSummary(true);
        }
      }
    } catch (err) {
      setSummarizeError(err instanceof Error ? err.message : 'Ett fel uppstod');
    } finally {
      setSummarizing(false);
    }
  };

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
              <div className="flex items-center gap-2">
                {!isFormatted && (
                  <button
                    onClick={handleFormat}
                    disabled={formatting}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {formatting ? (
                      <>
                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                        Formaterar...
                      </>
                    ) : (
                      <>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                        Formatera
                      </>
                    )}
                  </button>
                )}
                {!hasSummary && (
                  <button
                    onClick={handleSummarize}
                    disabled={summarizing}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {summarizing ? (
                      <>
                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                        Sammanfattar...
                      </>
                    ) : (
                      <>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h7a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                        </svg>
                        Sammanfatta
                      </>
                    )}
                  </button>
                )}
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
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Radera
                </button>
              </div>
            </div>

            {(formatError || summarizeError) && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {formatError || summarizeError}
              </div>
            )}

            <article className="bg-white p-8 md:p-12 rounded-xl shadow-sm border border-gray-200">
              <div className="transcript-content">
                <ReactMarkdown
                  components={{
                    h1: ({ children }) => (
                      <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
                        {children}
                      </h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-4">
                        {children}
                      </h2>
                    ),
                    p: ({ children }) => (
                      <p className="text-gray-700 text-lg leading-relaxed mb-6">
                        {children}
                      </p>
                    ),
                    blockquote: ({ children }) => (
                      <blockquote className="border-l-4 border-blue-500 bg-blue-50 pl-4 py-3 my-6 text-gray-600">
                        {children}
                      </blockquote>
                    ),
                    a: ({ href, children }) => (
                      <a
                        href={href}
                        className="text-blue-600 hover:text-blue-800 underline"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {children}
                      </a>
                    ),
                    strong: ({ children }) => (
                      <strong className="font-semibold text-gray-900">
                        {children}
                      </strong>
                    ),
                    hr: () => <hr className="my-8 border-gray-200" />,
                    ul: ({ children }) => (
                      <ul className="list-disc list-inside space-y-2 mb-6 text-gray-700">
                        {children}
                      </ul>
                    ),
                    li: ({ children }) => (
                      <li className="text-gray-700">{children}</li>
                    ),
                  }}
                >
                  {content || ''}
                </ReactMarkdown>
              </div>
            </article>
          </>
        )}
      </div>

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              Radera transkript
            </h3>
            <p className="text-gray-600 mb-4">
              Är du säker på att du vill radera detta transkript? Detta kan inte ångras.
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Admin-nyckel
              </label>
              <input
                type="password"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                placeholder="Ange admin-nyckel"
              />
            </div>

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
                }}
                className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium"
              >
                Avbryt
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting || !adminKey}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? 'Raderar...' : 'Radera'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
