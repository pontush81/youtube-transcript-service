'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function TranscriptForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOptional, setShowOptional] = useState(false);

  const [url, setUrl] = useState('');
  const [submitter, setSubmitter] = useState('');
  const [tags, setTags] = useState('');
  const [notes, setNotes] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
          placeholder="https://www.youtube.com/watch?v=..."
          required
          className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
        />
      </div>

      {/* Collapsible optional fields */}
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

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="w-full py-2.5 sm:py-3 px-6 bg-blue-600 text-white text-sm sm:text-base font-medium rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 disabled:bg-blue-400 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
      >
        {isLoading ? (
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
            Hämtar transkript...
          </>
        ) : (
          'Hämta transkript'
        )}
      </button>
    </form>
  );
}
