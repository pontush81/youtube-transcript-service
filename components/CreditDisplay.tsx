'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export function CreditDisplay() {
  const [credits, setCredits] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCredits() {
      try {
        const res = await fetch('/api/credits');
        if (res.ok) {
          const data = await res.json();
          setCredits(data.balance);
        }
      } catch (error) {
        console.error('Failed to fetch credits:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchCredits();
  }, []);

  if (loading) {
    return <span className="text-gray-400">...</span>;
  }

  if (credits === null) {
    return null;
  }

  const isLow = credits <= 5;

  return (
    <Link
      href="/credits"
      className={`flex items-center gap-1 px-2 py-1 rounded text-sm ${
        isLow
          ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
          : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
      }`}
    >
      <span>{credits}</span>
      <span className="hidden sm:inline">credits</span>
    </Link>
  );
}
