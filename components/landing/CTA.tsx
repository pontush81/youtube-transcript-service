import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export function CTA() {
  return (
    <section className="py-20 sm:py-32 bg-red-600">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Ready to turn videos into knowledge?
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-red-100">
          Start free with 3 transcripts per day. No credit card required.
        </p>
        <div className="mt-10">
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 rounded-lg bg-white px-8 py-4 text-lg font-semibold text-red-600 shadow-lg transition hover:bg-gray-100"
          >
            Get Started Free
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
