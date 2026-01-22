import Link from 'next/link';
import TranscriptForm from '@/components/TranscriptForm';

export default function Home() {
  return (
    <main className="min-h-screen py-12 px-4">
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            YouTube Transcript Service
          </h1>
          <p className="text-gray-600">
            Klistra in en YouTube-URL för att hämta transkriptet som Markdown-fil
          </p>
        </div>

        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
          <TranscriptForm />
        </div>

        <div className="mt-8 text-center space-y-3">
          <p className="text-sm text-gray-500">
            Fungerar med alla YouTube-videor som har captions aktiverade.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              href="/transcripts"
              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                <path
                  fillRule="evenodd"
                  d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z"
                  clipRule="evenodd"
                />
              </svg>
              Visa sparade transkript
            </Link>
            <Link
              href="/chat"
              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z"
                  clipRule="evenodd"
                />
              </svg>
              Chatta med transkript
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
