'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface DayUsage {
  date: string;
  summary: number;
  chat: number;
}

interface UsageHistory {
  history: DayUsage[];
  totals: { summary: number; chat: number };
  days: number;
}

interface CurrentUsage {
  plan: 'free' | 'pro';
  summary: { used: number; limit: number; remaining: number };
  chat: { used: number; limit: number; remaining: number };
}

export default function UsagePage() {
  const [history, setHistory] = useState<UsageHistory | null>(null);
  const [current, setCurrent] = useState<CurrentUsage | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/usage/history?days=${days}`).then((r) => r.json()),
      fetch('/api/usage').then((r) => r.json()),
    ])
      .then(([h, c]) => {
        setHistory(h);
        setCurrent(c);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [days]);

  if (loading) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-12">
        <p className="text-center text-gray-500">Loading...</p>
      </main>
    );
  }

  const isPro = current?.plan === 'pro';

  return (
    <main className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold mb-6">Usage</h1>

      {/* Current plan & today */}
      {current && (
        <div className="mb-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Plan</p>
            <p className="text-lg font-semibold mt-1">
              {isPro ? 'Pro' : 'Free'}
              {!isPro && (
                <Link href="/pricing" className="text-sm text-blue-600 ml-2 font-normal">
                  Upgrade
                </Link>
              )}
            </p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Summaries today</p>
            <p className="text-lg font-semibold mt-1">
              {isPro ? current.summary.used : `${current.summary.used} / ${current.summary.limit}`}
            </p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Chat today</p>
            <p className="text-lg font-semibold mt-1">
              {isPro ? current.chat.used : `${current.chat.used} / ${current.chat.limit}`}
            </p>
          </div>
        </div>
      )}

      {/* Period selector */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">History</h2>
        <div className="flex gap-2">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1 text-sm rounded-lg border transition ${
                days === d
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Totals */}
      {history && (
        <div className="mb-4 text-sm text-gray-500">
          Last {history.days} days: {history.totals.summary} summaries, {history.totals.chat} chat messages
        </div>
      )}

      {/* Table */}
      {history && history.history.length > 0 ? (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left px-4 py-2 font-medium text-gray-600">Date</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600">Summaries</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600">Chat</th>
              </tr>
            </thead>
            <tbody>
              {history.history.map((day) => (
                <tr key={day.date} className="border-b last:border-0">
                  <td className="px-4 py-2 text-gray-700">
                    {new Date(day.date + 'T00:00:00').toLocaleDateString('sv-SE')}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{day.summary}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{day.chat}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-lg border p-8 text-center text-gray-500">
          No usage recorded in this period.
        </div>
      )}
    </main>
  );
}
