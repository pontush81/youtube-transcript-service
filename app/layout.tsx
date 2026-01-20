import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
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
        {children}
        <Analytics />
      </body>
    </html>
  );
}
