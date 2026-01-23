import Link from 'next/link';
import TranscriptForm from '@/components/TranscriptForm';

export default function Home() {
  return (
    <main className="py-6 sm:py-12 px-4">
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-6 sm:mb-10">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2 sm:mb-3">
            Hämta YouTube-transkript
          </h1>
          <p className="text-gray-600 text-sm sm:text-base">
            Klistra in en URL för att ladda ner transkriptet som Markdown
          </p>
        </div>

        <div className="bg-white p-5 sm:p-8 rounded-xl shadow-sm border border-gray-200">
          <TranscriptForm />
        </div>

        <p className="mt-6 text-center text-xs sm:text-sm text-gray-500">
          Fungerar med alla YouTube-videor som har captions aktiverade.
        </p>

        {/* Quick action cards for mobile */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:hidden">
          <Link
            href="/transcripts"
            className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all"
          >
            <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="text-sm font-medium text-gray-900">Transkript</span>
          </Link>
          <Link
            href="/chat"
            className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all"
          >
            <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <span className="text-sm font-medium text-gray-900">AI Chatt</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
