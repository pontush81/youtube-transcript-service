import { Sparkles, Users } from 'lucide-react';
import Link from 'next/link';

export function BetaCTA() {
  return (
    <section className="py-20 sm:py-32 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl bg-gradient-to-r from-red-50 to-orange-50 p-8 sm:p-12">
          <div className="flex flex-col items-center text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-red-100 px-4 py-2 text-sm font-medium text-red-700">
              <Sparkles className="h-4 w-4" />
              Early Access
            </div>

            <h2 className="mt-6 text-3xl font-bold tracking-tight text-gray-900">
              Join the beta
            </h2>

            <p className="mt-4 max-w-2xl text-lg text-gray-600">
              We&apos;re building the best way to learn from YouTube.
              Start free and help shape the product.
            </p>

            <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row">
              <Link
                href="/sign-up"
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-6 py-3 font-semibold text-white transition hover:bg-red-700"
              >
                <Users className="h-5 w-5" />
                Get Early Access
              </Link>
              <span className="text-sm text-gray-500">Free forever for early users</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
