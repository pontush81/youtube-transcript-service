'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

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

export function UsageDisplay() {
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return <span className="text-gray-400">...</span>;
  }

  if (!data) {
    return null;
  }

  const chatsRemaining = data.usage.chats.limit - data.usage.chats.used;
  const isLow = chatsRemaining <= 2;
  const isPro = data.plan === 'pro';

  return (
    <Link
      href="/pricing"
      className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm ${
        isPro
          ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
          : isLow
          ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
          : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
      }`}
    >
      {isPro ? (
        <>
          <span className="font-medium">Pro</span>
          <span className="hidden sm:inline">
            {data.usage.chats.used}/{data.usage.chats.limit} chats
          </span>
        </>
      ) : (
        <>
          <span>{chatsRemaining}/{data.usage.chats.limit}</span>
          <span className="hidden sm:inline">idag</span>
        </>
      )}
    </Link>
  );
}
