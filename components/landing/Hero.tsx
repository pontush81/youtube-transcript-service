'use client';

import Link from 'next/link';
import { Play, ArrowRight } from 'lucide-react';

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-gray-50 to-white py-20 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-red-50 px-4 py-2 text-sm text-red-700">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500"></span>
            </span>
            Now with AI-powered chat
          </div>

          {/* Headline */}
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
            Turn YouTube Videos Into
            <span className="block text-red-600">Searchable Knowledge</span>
          </h1>

          {/* Subheadline */}
          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600">
            Extract transcripts from any YouTube video, chat with AI to find insights,
            and build your personal video knowledge base. Free to start.
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-8 py-4 text-lg font-semibold text-white shadow-lg transition hover:bg-red-700 hover:shadow-xl"
            >
              Start Free
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href="#how-it-works"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-8 py-4 text-lg font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              <Play className="h-5 w-5" />
              See How It Works
            </Link>
          </div>
        </div>

        {/* Product screenshot/demo placeholder */}
        <div className="mt-16 sm:mt-20">
          <div className="relative mx-auto max-w-5xl">
            <div className="rounded-xl bg-gray-900/5 p-2 ring-1 ring-gray-900/10">
              <div className="rounded-lg bg-white p-4 shadow-2xl ring-1 ring-gray-900/5">
                <div className="aspect-video rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                  <div className="text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                      <Play className="h-8 w-8 text-red-600" />
                    </div>
                    <p className="text-gray-500">Product demo coming soon</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
