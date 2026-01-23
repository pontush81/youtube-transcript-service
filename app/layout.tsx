import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import { Providers } from "@/components/Providers";
import { NavHeader } from "@/components/NavHeader";
import { ToastProvider } from "@/components/Toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "YouTube Transcript Service",
  description: "Hämta transkript från YouTube-videor och ladda ner som Markdown",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sv">
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
