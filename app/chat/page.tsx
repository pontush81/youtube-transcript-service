import Link from 'next/link';
import { ChatWindow } from '@/components/chat';

export default function ChatPage() {
  return (
    <main className="min-h-screen py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Transcript Chat
            </h1>
            <p className="text-gray-600 text-sm">
              Ställ frågor om dina sparade YouTube-transkript
            </p>
          </div>
          <Link
            href="/"
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Tillbaka till start
          </Link>
        </div>

        <ChatWindow />
      </div>
    </main>
  );
}
