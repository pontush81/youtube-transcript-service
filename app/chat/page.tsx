import { ChatWindow } from '@/components/chat';

export default function ChatPage() {
  return (
    <main className="h-[calc(100vh-3.5rem)] sm:h-[calc(100vh-4rem)] p-2 sm:p-4">
      <div className="max-w-6xl mx-auto h-full">
        <ChatWindow />
      </div>
    </main>
  );
}
