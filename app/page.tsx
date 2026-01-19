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

        <div className="mt-8 text-center text-sm text-gray-500">
          <p>
            Fungerar med alla YouTube-videor som har captions aktiverade.
          </p>
        </div>
      </div>
    </main>
  );
}
