import Link from 'next/link';

export default function VerifyRequestPage() {
  return (
    <main className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          {/* Email icon */}
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Kolla din e-post
          </h1>

          <p className="text-gray-600 mb-6">
            Vi har skickat en inloggningslänk till din e-postadress.
            Klicka på länken för att logga in.
          </p>

          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-500">
              Länken är giltig i 24 timmar. Om du inte ser mailet,
              kolla din skräppost.
            </p>
          </div>

          <Link
            href="/login"
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            ← Tillbaka till inloggning
          </Link>
        </div>
      </div>
    </main>
  );
}
