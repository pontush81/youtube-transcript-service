# Freemium + Subscription Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace credit system with freemium (5 chats/day, 3 transcripts/day) + Pro subscription (99 kr/mo).

**Architecture:** New `usage` and `subscriptions` tables track usage. `lib/usage.ts` handles checks and logging. Stripe subscription webhook activates Pro. Existing credit code remains but unused.

**Tech Stack:** PostgreSQL, Stripe subscriptions, Next.js API routes, React components

---

## Task 1: Database Migration - Usage Table

**Files:**
- Create: `app/api/db/migrate-usage/route.ts`

**Step 1: Create migration endpoint**

```typescript
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { isUserAdmin } from '@/lib/admin';
import { auth } from '@clerk/nextjs/server';

export async function POST() {
  const { userId } = await auth();
  if (!userId || !(await isUserAdmin(userId))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Create usage table
  await sql`
    CREATE TABLE IF NOT EXISTS usage (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      usage_type TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  // Create index for efficient queries
  await sql`
    CREATE INDEX IF NOT EXISTS idx_usage_user_date
    ON usage(user_id, created_at)
  `;

  // Create subscriptions table
  await sql`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id SERIAL PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL,
      stripe_subscription_id TEXT,
      stripe_customer_id TEXT,
      status TEXT NOT NULL DEFAULT 'inactive',
      current_period_end TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;

  return NextResponse.json({
    success: true,
    message: 'Usage and subscriptions tables created'
  });
}
```

**Step 2: Run migration**

```bash
curl -X POST https://youtube-transcript-service-two.vercel.app/api/db/migrate-usage \
  -H "x-admin-key: YOUR_ADMIN_KEY"
```

Expected: `{"success":true,"message":"Usage and subscriptions tables created"}`

**Step 3: Commit**

```bash
git add app/api/db/migrate-usage/route.ts
git commit -m "feat: add usage and subscriptions table migration"
```

---

## Task 2: Usage Library

**Files:**
- Create: `lib/usage.ts`

**Step 1: Create usage library**

```typescript
import { sql } from '@/lib/db';

export type UsageType = 'chat' | 'transcript';

export interface UsageLimits {
  chats: { used: number; limit: number };
  transcripts: { used: number; limit: number };
}

export interface UserPlan {
  plan: 'free' | 'pro';
  limits: UsageLimits;
  subscription?: {
    status: string;
    currentPeriodEnd: Date | null;
  };
}

// Free tier limits
const FREE_LIMITS = {
  chatsPerDay: 5,
  transcriptsPerDay: 3,
};

// Pro tier limits (per month)
const PRO_LIMITS = {
  chatsPerMonth: 1000,
  transcriptsPerMonth: 200,
};

/**
 * Check if user has an active Pro subscription
 */
export async function isProUser(userId: string): Promise<boolean> {
  const result = await sql`
    SELECT status, current_period_end
    FROM subscriptions
    WHERE user_id = ${userId}
  `;

  const sub = result.rows[0];
  if (!sub) return false;

  // Check if subscription is active and not expired
  if (sub.status !== 'active') return false;
  if (sub.current_period_end && new Date(sub.current_period_end) < new Date()) return false;

  return true;
}

/**
 * Get usage counts for current period
 */
export async function getUsage(userId: string): Promise<UsageLimits> {
  const isPro = await isProUser(userId);

  if (isPro) {
    // Pro: count usage this month
    const result = await sql`
      SELECT
        COUNT(*) FILTER (WHERE usage_type = 'chat') as chats,
        COUNT(*) FILTER (WHERE usage_type = 'transcript') as transcripts
      FROM usage
      WHERE user_id = ${userId}
        AND created_at >= date_trunc('month', NOW())
    `;

    const row = result.rows[0];
    return {
      chats: {
        used: parseInt(row?.chats || '0'),
        limit: PRO_LIMITS.chatsPerMonth
      },
      transcripts: {
        used: parseInt(row?.transcripts || '0'),
        limit: PRO_LIMITS.transcriptsPerMonth
      },
    };
  } else {
    // Free: count usage today
    const result = await sql`
      SELECT
        COUNT(*) FILTER (WHERE usage_type = 'chat') as chats,
        COUNT(*) FILTER (WHERE usage_type = 'transcript') as transcripts
      FROM usage
      WHERE user_id = ${userId}
        AND created_at >= date_trunc('day', NOW())
    `;

    const row = result.rows[0];
    return {
      chats: {
        used: parseInt(row?.chats || '0'),
        limit: FREE_LIMITS.chatsPerDay
      },
      transcripts: {
        used: parseInt(row?.transcripts || '0'),
        limit: FREE_LIMITS.transcriptsPerDay
      },
    };
  }
}

/**
 * Check if user can perform an action
 */
export async function canUse(userId: string, type: UsageType): Promise<boolean> {
  const usage = await getUsage(userId);

  if (type === 'chat') {
    return usage.chats.used < usage.chats.limit;
  } else {
    return usage.transcripts.used < usage.transcripts.limit;
  }
}

/**
 * Log usage and return true if allowed, false if limit exceeded
 */
export async function logUsage(userId: string, type: UsageType): Promise<boolean> {
  const allowed = await canUse(userId, type);

  if (!allowed) {
    return false;
  }

  await sql`
    INSERT INTO usage (user_id, usage_type, created_at)
    VALUES (${userId}, ${type}, NOW())
  `;

  return true;
}

/**
 * Get full user plan info
 */
export async function getUserPlan(userId: string): Promise<UserPlan> {
  const isPro = await isProUser(userId);
  const limits = await getUsage(userId);

  // Get subscription info if exists
  const subResult = await sql`
    SELECT status, current_period_end
    FROM subscriptions
    WHERE user_id = ${userId}
  `;

  const sub = subResult.rows[0];

  return {
    plan: isPro ? 'pro' : 'free',
    limits,
    subscription: sub ? {
      status: sub.status,
      currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end) : null,
    } : undefined,
  };
}

/**
 * Activate Pro subscription for user
 */
export async function activateSubscription(
  userId: string,
  stripeSubscriptionId: string,
  stripeCustomerId: string,
  currentPeriodEnd: Date
): Promise<void> {
  await sql`
    INSERT INTO subscriptions (user_id, stripe_subscription_id, stripe_customer_id, status, current_period_end, updated_at)
    VALUES (${userId}, ${stripeSubscriptionId}, ${stripeCustomerId}, 'active', ${currentPeriodEnd.toISOString()}, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      stripe_subscription_id = EXCLUDED.stripe_subscription_id,
      stripe_customer_id = EXCLUDED.stripe_customer_id,
      status = 'active',
      current_period_end = EXCLUDED.current_period_end,
      updated_at = NOW()
  `;
}

/**
 * Cancel subscription (set to inactive)
 */
export async function cancelSubscription(userId: string): Promise<void> {
  await sql`
    UPDATE subscriptions
    SET status = 'canceled', updated_at = NOW()
    WHERE user_id = ${userId}
  `;
}

/**
 * Update subscription period end (for renewals)
 */
export async function updateSubscriptionPeriod(
  stripeSubscriptionId: string,
  currentPeriodEnd: Date
): Promise<void> {
  await sql`
    UPDATE subscriptions
    SET current_period_end = ${currentPeriodEnd.toISOString()}, updated_at = NOW()
    WHERE stripe_subscription_id = ${stripeSubscriptionId}
  `;
}
```

**Step 2: Commit**

```bash
git add lib/usage.ts
git commit -m "feat: add usage tracking library with free/pro limits"
```

---

## Task 3: Usage API Endpoint

**Files:**
- Create: `app/api/usage/route.ts`

**Step 1: Create usage endpoint**

```typescript
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getUserPlan } from '@/lib/usage';

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const plan = await getUserPlan(userId);

  return NextResponse.json({
    plan: plan.plan,
    usage: plan.limits,
    subscription: plan.subscription ? {
      status: plan.subscription.status,
      renewsAt: plan.subscription.currentPeriodEnd?.toISOString(),
    } : null,
  });
}
```

**Step 2: Commit**

```bash
git add app/api/usage/route.ts
git commit -m "feat: add usage API endpoint"
```

---

## Task 4: Update Chat API to Use Usage System

**Files:**
- Modify: `app/api/chat/route.ts`

**Step 1: Update imports**

Replace credit imports with usage imports at the top of the file:

```typescript
// Remove these lines:
// import { useCredit, hasCredits } from '@/lib/credits';

// Add this line:
import { canUse, logUsage } from '@/lib/usage';
```

**Step 2: Replace credit check with usage check**

Find the credit check block (around lines 28-43) and replace with:

```typescript
  // Usage check (skip for admins)
  if (!isAdmin) {
    const allowed = await canUse(userId, 'chat');
    if (!allowed) {
      return new Response(
        JSON.stringify({
          error: 'Du har nått din dagliga gräns. Uppgradera till Pro för mer.',
          code: 'USAGE_LIMIT'
        }),
        { status: 402, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }
```

**Step 3: Replace credit deduction with usage logging**

Find the credit deduction block (around lines 99-111) and replace with:

```typescript
    // Log usage (skip for admins)
    if (!isAdmin) {
      const logged = await logUsage(userId, 'chat');
      if (!logged) {
        return new Response(
          JSON.stringify({
            error: 'Du har nått din dagliga gräns. Uppgradera till Pro för mer.',
            code: 'USAGE_LIMIT'
          }),
          { status: 402, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }
```

**Step 4: Commit**

```bash
git add app/api/chat/route.ts
git commit -m "feat: switch chat API from credits to usage system"
```

---

## Task 5: Update Add Content API to Use Usage System

**Files:**
- Modify: `app/api/add/route.ts`

**Step 1: Add usage import**

Add at the top of the file:

```typescript
import { canUse, logUsage } from '@/lib/usage';
import { isUserAdmin } from '@/lib/admin';
```

**Step 2: Add usage check after auth check**

After the userId check (around line 23), add:

```typescript
  // Usage check (skip for admins)
  const isAdmin = await isUserAdmin(userId);
  if (!isAdmin) {
    const allowed = await canUse(userId, 'transcript');
    if (!allowed) {
      return NextResponse.json(
        {
          error: 'Du har nått din dagliga gräns. Uppgradera till Pro för mer.',
          code: 'USAGE_LIMIT'
        },
        { status: 402 }
      );
    }
  }
```

**Step 3: Add usage logging in handleYouTube**

Before the success return in `handleYouTube` (around line 131), add:

```typescript
  // Log usage
  const isAdmin = await isUserAdmin(userId);
  if (!isAdmin) {
    await logUsage(userId, 'transcript');
  }
```

**Step 4: Add usage logging in handleWebContent**

Before the success return in `handleWebContent` (around line 200), add:

```typescript
  // Log usage
  const isAdmin = await isUserAdmin(userId);
  if (!isAdmin) {
    await logUsage(userId, 'transcript');
  }
```

**Step 5: Commit**

```bash
git add app/api/add/route.ts
git commit -m "feat: add usage tracking to add content API"
```

---

## Task 6: Stripe Subscription Product Setup

**Step 1: Create subscription product in Stripe Dashboard**

1. Go to https://dashboard.stripe.com/products
2. Click "Add product"
3. Name: "Pro Subscription"
4. Price: 99 kr
5. Billing period: Monthly
6. Save and copy the Price ID (starts with `price_`)

**Step 2: Add environment variable**

Add to Vercel and `.env.local`:
```
STRIPE_PRICE_PRO_SUBSCRIPTION=price_xxx
```

**Step 3: Document the change**

Note: This is a manual step - no code to commit.

---

## Task 7: Subscription Checkout Endpoint

**Files:**
- Create: `app/api/subscribe/route.ts`

**Step 1: Create subscription endpoint**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-12-15.clover',
});

export async function POST(request: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const priceId = process.env.STRIPE_PRICE_PRO_SUBSCRIPTION;

  if (!priceId) {
    return NextResponse.json(
      { error: 'Subscription not configured' },
      { status: 500 }
    );
  }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/pricing?success=true`,
      cancel_url: `${baseUrl}/pricing?canceled=true`,
      metadata: {
        userId,
      },
      subscription_data: {
        metadata: {
          userId,
        },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Subscription checkout error:', error);
    return NextResponse.json(
      { error: 'Kunde inte skapa checkout-session' },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit**

```bash
git add app/api/subscribe/route.ts
git commit -m "feat: add subscription checkout endpoint"
```

---

## Task 8: Update Stripe Webhook for Subscriptions

**Files:**
- Modify: `app/api/webhooks/stripe/route.ts`

**Step 1: Update webhook to handle subscription events**

Replace the entire file with:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { addCredits } from '@/lib/credits';
import { activateSubscription, cancelSubscription, updateSubscriptionPeriod } from '@/lib/usage';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-12-15.clover',
});

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  console.log('Stripe webhook event:', event.type);

  // Handle one-time credit purchases (legacy)
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;

    // Only handle one-time payments (not subscriptions)
    if (session.mode === 'payment') {
      const { userId, credits } = session.metadata || {};
      if (userId && credits) {
        try {
          const newBalance = await addCredits(userId, parseInt(credits, 10));
          console.log(`Added ${credits} credits to user ${userId}. New balance: ${newBalance}`);
        } catch (error) {
          console.error('Failed to add credits:', error);
        }
      }
    }
  }

  // Handle subscription created/updated
  if (event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.updated') {
    const subscription = event.data.object as Stripe.Subscription;
    const userId = subscription.metadata.userId;

    if (userId && subscription.status === 'active') {
      try {
        await activateSubscription(
          userId,
          subscription.id,
          subscription.customer as string,
          new Date(subscription.current_period_end * 1000)
        );
        console.log(`Activated subscription for user ${userId}`);
      } catch (error) {
        console.error('Failed to activate subscription:', error);
      }
    }
  }

  // Handle subscription canceled or expired
  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription;
    const userId = subscription.metadata.userId;

    if (userId) {
      try {
        await cancelSubscription(userId);
        console.log(`Canceled subscription for user ${userId}`);
      } catch (error) {
        console.error('Failed to cancel subscription:', error);
      }
    }
  }

  // Handle invoice paid (subscription renewal)
  if (event.type === 'invoice.paid') {
    const invoice = event.data.object as Stripe.Invoice;

    if (invoice.subscription) {
      try {
        const subscription = await stripe.subscriptions.retrieve(
          invoice.subscription as string
        );
        await updateSubscriptionPeriod(
          subscription.id,
          new Date(subscription.current_period_end * 1000)
        );
        console.log(`Updated subscription period for ${subscription.id}`);
      } catch (error) {
        console.error('Failed to update subscription period:', error);
      }
    }
  }

  return NextResponse.json({ received: true });
}
```

**Step 2: Commit**

```bash
git add app/api/webhooks/stripe/route.ts
git commit -m "feat: add subscription webhook handling"
```

---

## Task 9: Usage Display Component

**Files:**
- Create: `components/UsageDisplay.tsx`

**Step 1: Create component**

```typescript
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
```

**Step 2: Commit**

```bash
git add components/UsageDisplay.tsx
git commit -m "feat: add usage display component"
```

---

## Task 10: Pricing Page

**Files:**
- Create: `app/pricing/page.tsx`

**Step 1: Create pricing page**

```typescript
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
              <span className="text-green-500">✓</span>
              5 AI-chats per dag
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              3 transkript per dag
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
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
              <span className="text-green-500">✓</span>
              1000 AI-chats per månad
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              200 transkript per månad
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              Spara i din kunskapsbas
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
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
```

**Step 2: Commit**

```bash
git add app/pricing/page.tsx
git commit -m "feat: add pricing page with free/pro tiers"
```

---

## Task 11: Update Navigation

**Files:**
- Identify and modify navigation component (likely `components/NavHeader.tsx` or similar)

**Step 1: Find navigation component**

```bash
grep -r "CreditDisplay" app/ components/ --include="*.tsx"
```

**Step 2: Replace CreditDisplay with UsageDisplay**

Change import:
```typescript
// import { CreditDisplay } from '@/components/CreditDisplay';
import { UsageDisplay } from '@/components/UsageDisplay';
```

Change usage:
```typescript
// <CreditDisplay />
<UsageDisplay />
```

**Step 3: Update links from /credits to /pricing**

Find and replace any hardcoded links to `/credits` with `/pricing`.

**Step 4: Commit**

```bash
git add .
git commit -m "feat: replace CreditDisplay with UsageDisplay in navigation"
```

---

## Task 12: Update Middleware for New Routes

**Files:**
- Modify: `middleware.ts` (if exists)

**Step 1: Check if middleware exists and add /pricing to public routes if needed**

```bash
cat middleware.ts 2>/dev/null || echo "No middleware.ts"
```

If middleware exists and restricts routes, add `/pricing` to public routes.

**Step 2: Commit if changes made**

```bash
git add middleware.ts
git commit -m "feat: add pricing route to middleware"
```

---

## Task 13: Deploy and Test

**Step 1: Push changes**

```bash
git push origin feature/knowledge-base-mvp
```

**Step 2: Run migration**

After deploy, run:
```bash
curl -X POST https://youtube-transcript-service-two.vercel.app/api/db/migrate-usage \
  -H "x-admin-key: YOUR_ADMIN_KEY"
```

**Step 3: Create Stripe subscription product**

1. Go to Stripe Dashboard → Products
2. Create "Pro Subscription" at 99 kr/month
3. Add `STRIPE_PRICE_PRO_SUBSCRIPTION` to Vercel env vars
4. Redeploy

**Step 4: Test the flow**

1. Visit /pricing as free user
2. Check usage display shows "X/5 idag"
3. Click "Uppgradera till Pro"
4. Complete Stripe checkout (use test card 4242 4242 4242 4242)
5. Verify webhook activates subscription
6. Check usage display shows "Pro" badge
7. Verify limits changed to monthly

---

## Task 14: Update TODO.md

**Files:**
- Modify: `docs/TODO.md`

**Step 1: Update TODO with completed items**

```markdown
# TODO - Knowledge Base

## Nästa steg

### Prioritet 1: Produktion-redo
- [x] **Upstash Redis** - Rate-limiting (configured but optional)
- [ ] **Clerk production keys** - Byt från development till production

### Prioritet 2: UX-förbättringar
- [x] **UsageDisplay i navbar** - Visa användning i header
- [ ] **Favicon** - Lägg till favicon

### Prioritet 3: Nice-to-have
- [ ] **Stripe test → live** - Byt till riktiga Stripe-nycklar
- [ ] **Ta bort debug-endpoint** - `/api/debug-transcript` är temporär
- [ ] **Usage history page** - Visa detaljerad användningshistorik

---

## Implementerat (2026-01-24)
- ✅ Freemium + subscription pricing model
- ✅ Usage tracking (daily for free, monthly for pro)
- ✅ Stripe subscription checkout
- ✅ UsageDisplay component
- ✅ Pricing page

## Implementerat (2026-01-23)
- ✅ Credit-system med PostgreSQL
- ✅ Stripe checkout för credit-köp
- ✅ Admin skip credits
- ✅ Supadata.ai för transkript
- ✅ Web scraping med Cheerio
- ✅ Unified `/api/add` endpoint
```

**Step 2: Commit**

```bash
git add docs/TODO.md
git commit -m "docs: update TODO with pricing implementation status"
```

---

## Summary

This plan implements:

1. **Database**: `usage` and `subscriptions` tables
2. **Library**: `lib/usage.ts` with free/pro limit checking
3. **APIs**: `/api/usage`, `/api/subscribe`, updated `/api/chat` and `/api/add`
4. **Stripe**: Subscription webhook handling
5. **UI**: `UsageDisplay` component and `/pricing` page
6. **Migration**: From credits to usage-based system

The credit system is preserved for backwards compatibility but no longer used.
