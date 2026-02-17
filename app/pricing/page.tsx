'use client';

import { useState, useEffect } from 'react';

interface UsageData {
  plan: 'free' | 'pro';
  summary: { used: number; limit: number; remaining: number };
  chat: { used: number; limit: number; remaining: number };
}

export default function PricingPage() {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [canceled, setCanceled] = useState(false);

  useEffect(() => {
    // Check URL params for Stripe redirect
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true') setSuccess(true);
    if (params.get('canceled') === 'true') setCanceled(true);

    // Fetch usage
    fetch('/api/usage')
      .then((r) => r.json())
      .then(setUsage)
      .catch(() => {});
  }, []);

  async function handleUpgrade() {
    setLoading(true);
    try {
      const res = await fetch('/api/stripe/checkout', { method: 'POST' });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Could not start checkout');
        setLoading(false);
      }
    } catch {
      alert('Something went wrong');
      setLoading(false);
    }
  }

  const isPro = usage?.plan === 'pro';

  return (
    <main className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-center mb-2">Pricing</h1>
      <p className="text-center text-gray-500 mb-10">
        Transcripts are always free. Upgrade for unlimited AI features.
      </p>

      {success && (
        <div className="mb-8 p-4 bg-green-50 border border-green-200 rounded-lg text-center text-green-800">
          Welcome to Pro! Your account has been upgraded.
        </div>
      )}
      {canceled && (
        <div className="mb-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-center text-yellow-800">
          Checkout canceled. You can upgrade anytime.
        </div>
      )}

      {/* Usage display if signed in */}
      {usage && !isPro && (
        <div className="mb-8 p-4 bg-blue-50 border border-blue-200 rounded-lg text-center text-sm text-blue-800">
          Today&apos;s usage: {usage.summary.used}/{usage.summary.limit} summaries, {usage.chat.used}/{usage.chat.limit} chat messages
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Free tier */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-xl font-semibold mb-1">Free</h2>
          <p className="text-3xl font-bold mb-4">$0<span className="text-base font-normal text-gray-500">/month</span></p>
          <ul className="space-y-3 text-sm text-gray-700 mb-6">
            <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">&#10003;</span> Unlimited transcripts</li>
            <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">&#10003;</span> Download as .md or .txt</li>
            <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">&#10003;</span> 3 AI summaries per day</li>
            <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">&#10003;</span> 10 AI chat messages per day</li>
          </ul>
          {!isPro && (
            <div className="text-center text-sm text-gray-500 py-2">Current plan</div>
          )}
        </div>

        {/* Pro tier */}
        <div className={`bg-white rounded-xl border-2 ${isPro ? 'border-green-500' : 'border-blue-500'} p-6 relative`}>
          {isPro && (
            <span className="absolute top-3 right-3 bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
              Current plan
            </span>
          )}
          <h2 className="text-xl font-semibold mb-1">Pro</h2>
          <p className="text-3xl font-bold mb-4">$5<span className="text-base font-normal text-gray-500">/month</span></p>
          <ul className="space-y-3 text-sm text-gray-700 mb-6">
            <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">&#10003;</span> Unlimited transcripts</li>
            <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">&#10003;</span> Download as .md or .txt</li>
            <li className="flex items-start gap-2"><span className="text-blue-500 mt-0.5 font-bold">&#10003;</span> Unlimited AI summaries</li>
            <li className="flex items-start gap-2"><span className="text-blue-500 mt-0.5 font-bold">&#10003;</span> Unlimited AI chat</li>
            <li className="flex items-start gap-2"><span className="text-blue-500 mt-0.5 font-bold">&#10003;</span> Priority processing</li>
          </ul>
          {!isPro && (
            <button
              onClick={handleUpgrade}
              disabled={loading}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition disabled:opacity-50"
            >
              {loading ? 'Redirecting...' : 'Upgrade to Pro'}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
