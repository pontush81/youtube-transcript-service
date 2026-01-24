'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

interface UsageData {
  plan: 'free' | 'pro';
  usage: {
    chats: { used: number; limit: number };
    transcripts: { used: number; limit: number };
  };
  subscription: {
    status: string;
    renewsAt: string;
  } | null;
}

function PricingContent() {
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const searchParams = useSearchParams();

  const success = searchParams.get('success') === 'true';
  const canceled = searchParams.get('canceled') === 'true';

  useEffect(() => {
    async function fetchUsage() {
      try {
        const res = await fetch('/api/usage');
        if (res.ok) {
          setData(await res.json());
        }
      } catch (error) {
        console.error('Failed to fetch usage:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchUsage();
  }, []);

  async function handleSubscribe() {
    setSubscribing(true);
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (res.ok) {
        const { url } = await res.json();
        if (url) {
          window.location.href = url;
        }
      } else {
        alert('Something went wrong. Please try again.');
      }
    } catch (error) {
      console.error('Subscribe error:', error);
      alert('Something went wrong. Please try again.');
    } finally {
      setSubscribing(false);
    }
  }

  const isPro = data?.plan === 'pro';

  return (
    <>
      {success && (
        <div className="mb-8 p-4 bg-green-100 text-green-700 rounded-lg text-center">
          Welcome to Pro! Your subscription is now active.
        </div>
      )}

      {canceled && (
        <div className="mb-8 p-4 bg-yellow-100 text-yellow-700 rounded-lg text-center">
          Subscription was canceled.
        </div>
      )}

      {/* Current usage */}
      {data && (
        <div className="text-center mb-8">
          <div className="inline-block bg-white dark:bg-gray-800 rounded-lg px-6 py-4 shadow">
            <div className="text-sm text-gray-500 mb-1">
              {isPro ? 'This month' : 'Today'}
            </div>
            <div className="flex gap-6">
              <div>
                <span className="text-2xl font-bold">{data.usage.chats.used}</span>
                <span className="text-gray-500">/{data.usage.chats.limit} chats</span>
              </div>
              <div>
                <span className="text-2xl font-bold">{data.usage.transcripts.used}</span>
                <span className="text-gray-500">/{data.usage.transcripts.limit} transcripts</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pricing cards */}
      <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        {/* Free tier */}
        <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 ${
          !isPro ? 'ring-2 ring-gray-300' : ''
        }`}>
          <h2 className="text-xl font-bold text-center mb-2">Free</h2>
          <div className="text-center mb-4">
            <span className="text-3xl font-bold">0 kr</span>
          </div>
          <ul className="space-y-2 mb-6 text-sm">
            <li className="flex items-center gap-2">
              <span className="text-green-500">&#10003;</span>
              3 AI chats per day
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">&#10003;</span>
              3 transcripts per day
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">&#10003;</span>
              Save to your knowledge base
            </li>
          </ul>
          {!isPro && (
            <div className="text-center text-sm text-gray-500">
              Your current plan
            </div>
          )}
        </div>

        {/* Pro tier */}
        <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 ${
          isPro ? 'ring-2 ring-purple-500' : 'ring-2 ring-purple-200'
        }`}>
          <div className="text-center mb-2">
            <span className="bg-purple-500 text-white text-xs px-2 py-1 rounded-full">
              Recommended
            </span>
          </div>
          <h2 className="text-xl font-bold text-center mb-2">Pro</h2>
          <div className="text-center mb-4">
            <span className="text-3xl font-bold">99 kr</span>
            <span className="text-gray-500">/month</span>
          </div>
          <ul className="space-y-2 mb-6 text-sm">
            <li className="flex items-center gap-2">
              <span className="text-green-500">&#10003;</span>
              300 AI chats per month
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">&#10003;</span>
              100 transcripts per month
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">&#10003;</span>
              Save to your knowledge base
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">&#10003;</span>
              Priority support
            </li>
          </ul>
          {isPro ? (
            <div className="text-center">
              <div className="text-sm text-purple-600 font-medium mb-1">
                Your current plan
              </div>
              {data?.subscription?.renewsAt && (
                <div className="text-xs text-gray-500">
                  Renews {new Date(data.subscription.renewsAt).toLocaleDateString('en-US')}
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={handleSubscribe}
              disabled={subscribing || loading}
              className="w-full py-3 rounded-lg font-semibold bg-purple-500 text-white hover:bg-purple-600 disabled:opacity-50 transition"
            >
              {subscribing ? 'Loading...' : 'Upgrade to Pro'}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-2">Pricing</h1>
        <p className="text-center text-gray-600 dark:text-gray-400 mb-8">
          Choose the plan that fits you
        </p>

        <Suspense fallback={<div className="text-center">Loading...</div>}>
          <PricingContent />
        </Suspense>
      </div>
    </div>
  );
}
