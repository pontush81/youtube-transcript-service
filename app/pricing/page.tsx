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
        alert('Något gick fel. Försök igen.');
      }
    } catch (error) {
      console.error('Subscribe error:', error);
      alert('Något gick fel. Försök igen.');
    } finally {
      setSubscribing(false);
    }
  }

  const isPro = data?.plan === 'pro';

  return (
    <>
      {success && (
        <div className="mb-8 p-4 bg-green-100 text-green-700 rounded-lg text-center">
          Välkommen till Pro! Din prenumeration är nu aktiv.
        </div>
      )}

      {canceled && (
        <div className="mb-8 p-4 bg-yellow-100 text-yellow-700 rounded-lg text-center">
          Prenumerationen avbröts.
        </div>
      )}

      {/* Current usage */}
      {data && (
        <div className="text-center mb-8">
          <div className="inline-block bg-white dark:bg-gray-800 rounded-lg px-6 py-4 shadow">
            <div className="text-sm text-gray-500 mb-1">
              {isPro ? 'Denna månad' : 'Idag'}
            </div>
            <div className="flex gap-6">
              <div>
                <span className="text-2xl font-bold">{data.usage.chats.used}</span>
                <span className="text-gray-500">/{data.usage.chats.limit} chats</span>
              </div>
              <div>
                <span className="text-2xl font-bold">{data.usage.transcripts.used}</span>
                <span className="text-gray-500">/{data.usage.transcripts.limit} transkript</span>
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
              5 AI-chats per dag
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">&#10003;</span>
              3 transkript per dag
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">&#10003;</span>
              Spara i din kunskapsbas
            </li>
          </ul>
          {!isPro && (
            <div className="text-center text-sm text-gray-500">
              Din nuvarande plan
            </div>
          )}
        </div>

        {/* Pro tier */}
        <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 ${
          isPro ? 'ring-2 ring-purple-500' : 'ring-2 ring-purple-200'
        }`}>
          <div className="text-center mb-2">
            <span className="bg-purple-500 text-white text-xs px-2 py-1 rounded-full">
              Rekommenderad
            </span>
          </div>
          <h2 className="text-xl font-bold text-center mb-2">Pro</h2>
          <div className="text-center mb-4">
            <span className="text-3xl font-bold">99 kr</span>
            <span className="text-gray-500">/månad</span>
          </div>
          <ul className="space-y-2 mb-6 text-sm">
            <li className="flex items-center gap-2">
              <span className="text-green-500">&#10003;</span>
              1000 AI-chats per månad
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">&#10003;</span>
              200 transkript per månad
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">&#10003;</span>
              Spara i din kunskapsbas
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">&#10003;</span>
              Prioriterad support
            </li>
          </ul>
          {isPro ? (
            <div className="text-center">
              <div className="text-sm text-purple-600 font-medium mb-1">
                Din nuvarande plan
              </div>
              {data?.subscription?.renewsAt && (
                <div className="text-xs text-gray-500">
                  Förnyas {new Date(data.subscription.renewsAt).toLocaleDateString('sv-SE')}
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={handleSubscribe}
              disabled={subscribing || loading}
              className="w-full py-3 rounded-lg font-semibold bg-purple-500 text-white hover:bg-purple-600 disabled:opacity-50 transition"
            >
              {subscribing ? 'Laddar...' : 'Uppgradera till Pro'}
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
        <h1 className="text-3xl font-bold text-center mb-2">Priser</h1>
        <p className="text-center text-gray-600 dark:text-gray-400 mb-8">
          Välj den plan som passar dig
        </p>

        <Suspense fallback={<div className="text-center">Laddar...</div>}>
          <PricingContent />
        </Suspense>
      </div>
    </div>
  );
}
