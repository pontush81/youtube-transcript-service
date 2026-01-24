import { FileText, MessageSquare, Database, Search, Clock, Download } from 'lucide-react';

const features = [
  {
    icon: FileText,
    title: 'Instant Transcripts',
    description: 'Extract text from any YouTube video with captions. Works with any language.',
  },
  {
    icon: MessageSquare,
    title: 'AI-Powered Chat',
    description: 'Ask questions across multiple videos. Get answers with clickable timestamps.',
  },
  {
    icon: Database,
    title: 'Knowledge Base',
    description: 'Save and organize your video library. Build your personal research database.',
  },
  {
    icon: Search,
    title: 'Smart Search',
    description: 'Find exactly what you need with semantic search across all your transcripts.',
  },
  {
    icon: Clock,
    title: 'Timestamp Links',
    description: 'Jump directly to the moment in the video. Every answer links back to the source.',
  },
  {
    icon: Download,
    title: 'Export Anywhere',
    description: 'Download as Markdown. Perfect for Notion, Obsidian, or any notes app.',
  },
];

export function Features() {
  return (
    <section className="py-20 sm:py-32 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Everything you need to learn from YouTube
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Stop rewatching videos. Start building knowledge.
          </p>
        </div>

        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-gray-200 p-8 transition hover:border-gray-300 hover:shadow-lg"
            >
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-red-100">
                <feature.icon className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900">{feature.title}</h3>
              <p className="mt-2 text-gray-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
