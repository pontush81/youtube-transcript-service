import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import { Providers } from "@/components/Providers";
import { NavHeader } from "@/components/NavHeader";
import { ToastProvider } from "@/components/Toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "TubeBase - Turn YouTube Videos Into Searchable Knowledge",
  description: "Extract transcripts from YouTube videos, chat with AI, and build your personal video knowledge base. Free to start.",
  keywords: ["youtube transcript", "video to text", "ai chat", "knowledge base", "youtube captions", "video transcription"],
  openGraph: {
    title: "TubeBase - YouTube Knowledge Base",
    description: "Extract transcripts, chat with AI, build your video knowledge base.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        <Providers>
          <ToastProvider>
            <NavHeader />
            <div className="min-h-[calc(100vh-3.5rem)] sm:min-h-[calc(100vh-4rem)]">
              {children}
            </div>
            <Analytics />
          </ToastProvider>
        </Providers>
      </body>
    </html>
  );
}
