'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Check, Sparkles } from 'lucide-react';

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

interface PricingTier {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  badge?: string;
  highlight?: boolean;
  available: boolean;
  cta: string;
}

const tiers: PricingTier[] = [
  {
    name: 'Free',
    price: '$0',
    period: '',
    description: 'Perfect for trying out TubeBase',
    features: [
      '3 transcripts per day',
      '3 AI chats per day',
      'Save to knowledge base',
      'Basic search',
    ],
    available: true,
    cta: 'Current Plan',
  },
  {
    name: 'Starter',
    price: '$4.99',
    period: '/month',
    description: 'For casual users and hobbyists',
    features: [
      '20 transcripts per month',
      '100 AI chats per month',
      'Everything in Free',
      'Priority processing',
    ],
    available: false,
    cta: 'Coming Soon',
  },
  {
    name: 'Pro',
    price: '$14.99',
    period: '/month',
    description: 'For power users and creators',
    features: [
      '100 transcripts per month',
      'Unlimited AI chats',
      'Everything in Starter',
      'Priority support',
      'Export to Markdown',
    ],
    badge: 'Most Popular',
    highlight: true,
    available: true,
    cta: 'Upgrade to Pro',
  },
  {
    name: 'Team',
    price: '$34.99',
    period: '/month',
    description: 'For teams and organizations',
    features: [
      'Unlimited transcripts',
      'Unlimited AI chats',
      'Everything in Pro',
      'API access',
      'Team collaboration',
    ],
    available: false,
    cta: 'Coming Soon',
  },
];

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

  async function handleSubscribe(tierName: string) {
    if (tierName !== 'Pro') return; // Only Pro is available for now

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

  function getTierCTA(tier: PricingTier): string {
    if (tier.name === 'Free' && !isPro) return 'Current Plan';
    if (tier.name === 'Pro' && isPro) return 'Current Plan';
    if (!tier.available) return 'Coming Soon';
    return tier.cta;
  }

  function isTierDisabled(tier: PricingTier): boolean {
    if (tier.name === 'Free') return true;
    if (tier.name === 'Pro' && isPro) return true;
    if (!tier.available) return true;
    return false;
  }

  return (
    <>
      {success && (
        <div className="mb-8 p-4 bg-green-100 text-green-700 rounded-lg text-center max-w-2xl mx-auto">
          <Sparkles className="inline h-5 w-5 mr-2" />
          Welcome to Pro! Your subscription is now active.
        </div>
      )}

      {canceled && (
        <div className="mb-8 p-4 bg-yellow-100 text-yellow-700 rounded-lg text-center max-w-2xl mx-auto">
          Subscription was canceled.
        </div>
      )}

      {/* Current usage */}
      {data && (
        <div className="text-center mb-12">
          <div className="inline-block bg-white rounded-xl px-8 py-6 shadow-lg">
            <div className="text-sm text-gray-500 mb-2 font-medium">
              Your usage {isPro ? 'this month' : 'today'}
            </div>
            <div className="flex gap-8">
              <div>
                <span className="text-3xl font-bold text-gray-900">{data.usage.chats.used}</span>
                <span className="text-gray-500">/{data.usage.chats.limit === -1 ? '∞' : data.usage.chats.limit}</span>
                <div className="text-xs text-gray-400 mt-1">chats</div>
              </div>
              <div>
                <span className="text-3xl font-bold text-gray-900">{data.usage.transcripts.used}</span>
                <span className="text-gray-500">/{data.usage.transcripts.limit === -1 ? '∞' : data.usage.transcripts.limit}</span>
                <div className="text-xs text-gray-400 mt-1">transcripts</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pricing cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto">
        {tiers.map((tier) => {
          const isCurrentPlan =
            (tier.name === 'Free' && !isPro) ||
            (tier.name === 'Pro' && isPro);

          return (
            <div
              key={tier.name}
              className={`relative bg-white rounded-2xl shadow-lg p-6 flex flex-col ${
                tier.highlight
                  ? 'ring-2 ring-red-500 scale-105 z-10'
                  : isCurrentPlan
                  ? 'ring-2 ring-gray-300'
                  : ''
              }`}
            >
              {tier.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                    {tier.badge}
                  </span>
                </div>
              )}

              <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-gray-900 mb-2">{tier.name}</h2>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-4xl font-bold text-gray-900">{tier.price}</span>
                  {tier.period && (
                    <span className="text-gray-500">{tier.period}</span>
                  )}
                </div>
                <p className="mt-2 text-sm text-gray-500">{tier.description}</p>
              </div>

              <ul className="space-y-3 mb-8 flex-grow">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm">
                    <Check className="h-5 w-5 text-green-500 shrink-0" />
                    <span className="text-gray-600">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSubscribe(tier.name)}
                disabled={isTierDisabled(tier) || subscribing || loading}
                className={`w-full py-3 rounded-lg font-semibold transition ${
                  tier.highlight && !isCurrentPlan && tier.available
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : isCurrentPlan
                    ? 'bg-gray-100 text-gray-500 cursor-default'
                    : tier.available
                    ? 'bg-gray-900 text-white hover:bg-gray-800'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                {subscribing && tier.name === 'Pro' ? 'Loading...' : getTierCTA(tier)}
              </button>

              {isCurrentPlan && data?.subscription?.renewsAt && (
                <p className="text-center text-xs text-gray-400 mt-2">
                  Renews {new Date(data.subscription.renewsAt).toLocaleDateString('en-US')}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Trust section */}
      <div className="mt-16 text-center">
        <div className="inline-flex items-center gap-6 text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <Check className="h-4 w-4 text-green-500" />
            No credit card required
          </span>
          <span className="flex items-center gap-1">
            <Check className="h-4 w-4 text-green-500" />
            Cancel anytime
          </span>
          <span className="flex items-center gap-1">
            <Check className="h-4 w-4 text-green-500" />
            Secure checkout
          </span>
        </div>
      </div>
    </>
  );
}

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-16 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Start free. Upgrade when you need more. No hidden fees.
          </p>
        </div>

        <Suspense fallback={
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-300 border-t-red-500"></div>
          </div>
        }>
          <PricingContent />
        </Suspense>
      </div>
    </div>
  );
}
