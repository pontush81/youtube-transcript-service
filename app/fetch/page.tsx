import TranscriptForm from '@/components/TranscriptForm';

export default function FetchPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Fetch YouTube Transcript
          </h1>
          <p className="mt-4 text-lg text-gray-600">
            Paste a URL to extract the transcript. Works with any video that has captions.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          <TranscriptForm />
        </div>

        <p className="mt-6 text-center text-sm text-gray-500">
          Supports individual videos and playlists. Download as Markdown or save to your library.
        </p>
      </div>
    </main>
  );
}
