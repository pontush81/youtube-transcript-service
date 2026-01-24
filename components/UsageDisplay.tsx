'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Sparkles } from 'lucide-react';

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

type WarningLevel = 'ok' | 'warning' | 'critical';

function getWarningLevel(used: number, limit: number): WarningLevel {
  if (limit === -1) return 'ok'; // Unlimited
  const percentage = (used / limit) * 100;
  if (percentage >= 100) return 'critical';
  if (percentage >= 80) return 'warning';
  return 'ok';
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

  const isPro = data.plan === 'pro';
  const chatWarning = getWarningLevel(data.usage.chats.used, data.usage.chats.limit);
  const transcriptWarning = getWarningLevel(data.usage.transcripts.used, data.usage.transcripts.limit);

  // Use the worse of the two warning levels
  const worstWarning: WarningLevel =
    chatWarning === 'critical' || transcriptWarning === 'critical' ? 'critical' :
    chatWarning === 'warning' || transcriptWarning === 'warning' ? 'warning' : 'ok';

  // Style based on warning level
  const getStyles = () => {
    if (isPro) {
      return 'bg-purple-100 text-purple-700';
    }
    switch (worstWarning) {
      case 'critical':
        return 'bg-red-100 text-red-700 animate-pulse';
      case 'warning':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  // Pro users: just show status badge (no link needed, Pricing is in nav)
  // Free users: link to pricing to upgrade
  if (isPro) {
    return (
      <div
        className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm ${getStyles()}`}
        title="Pro subscription active"
      >
        <Sparkles className="h-4 w-4" />
        <span className="font-medium">Pro</span>
      </div>
    );
  }

  return (
    <Link
      href="/pricing"
      className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors hover:opacity-80 ${getStyles()}`}
      title={worstWarning !== 'ok' ? 'Approaching limit - click to upgrade' : 'View usage & upgrade'}
    >
      {worstWarning !== 'ok' && (
        <AlertTriangle className="h-4 w-4" />
      )}
      <span>{data.usage.chats.used}/{data.usage.chats.limit}</span>
      <span className="hidden sm:inline">
        {worstWarning === 'critical' ? '- Upgrade' : 'chats'}
      </span>
    </Link>
  );
}
