# Freemium Monetization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add freemium monetization so transcript features are free, AI features (summary/chat) are limited for free users, and Pro users ($5/month) get unlimited access.

**Architecture:** Clerk handles auth and stores subscription tier in `publicMetadata.plan`. Upstash Redis tracks daily AI usage per user. Stripe handles payments via checkout sessions on the web app. The Chrome extension bridges Clerk auth from popup to content script via `chrome.storage`. API endpoints check plan + usage before processing AI requests.

**Tech Stack:** Clerk (auth + user metadata), Stripe (payments), Upstash Redis (usage tracking), Next.js API routes, Chrome extension (`@clerk/chrome-extension`)

---

## Overview

### Free Tier
- Transcript: unlimited
- Download (.md/.txt): unlimited
- AI Summary: 3 per day
- AI Chat: 10 messages per day

### Pro Tier ($5/month)
- Everything unlimited
- Priority processing

### Gated Endpoints
- `POST /api/summary` — AI cost
- `POST /api/chat/extension` — AI cost
- `POST /api/chat` — AI cost (web app, already auth-gated)

### NOT Gated
- `POST /api/transcript` — free, drives adoption
- Download — happens locally in extension, no server cost

---

## Task 1: Usage Tracking Module

**Files:**
- Create: `lib/usage.ts`

**What it does:** Track and check daily AI usage per user using Upstash Redis. Keys expire after 24h automatically.

**Implementation:**

```typescript
// lib/usage.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

const LIMITS = {
  free: { summary: 3, chat: 10 },
  pro: { summary: Infinity, chat: Infinity },
} as const;

type Plan = keyof typeof LIMITS;
type Feature = 'summary' | 'chat';

function dailyKey(userId: string, feature: Feature): string {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return `usage:${feature}:${userId}:${date}`;
}

export async function checkUsage(
  userId: string | null,
  feature: Feature,
  plan: Plan = 'free'
): Promise<{ allowed: boolean; used: number; limit: number; remaining: number }> {
  const limit = LIMITS[plan][feature];
  if (limit === Infinity) {
    return { allowed: true, used: 0, limit: -1, remaining: -1 };
  }

  // Anonymous users (no auth) get free tier
  const key = dailyKey(userId || 'anon', feature);

  try {
    const used = (await redis.get<number>(key)) || 0;
    return {
      allowed: used < limit,
      used,
      limit,
      remaining: Math.max(0, limit - used),
    };
  } catch {
    // If Redis fails, allow the request (fail open)
    return { allowed: true, used: 0, limit, remaining: limit };
  }
}

export async function incrementUsage(
  userId: string | null,
  feature: Feature
): Promise<void> {
  const key = dailyKey(userId || 'anon', feature);
  try {
    const pipeline = redis.pipeline();
    pipeline.incr(key);
    pipeline.expire(key, 86400); // 24h TTL
    await pipeline.exec();
  } catch {
    // Non-critical — don't fail the request
  }
}

export function getUserPlan(publicMetadata: Record<string, unknown> | null): Plan {
  if (!publicMetadata) return 'free';
  return publicMetadata.plan === 'pro' ? 'pro' : 'free';
}
```

**Test:** Manually test by calling from a route handler, verify Redis keys are created.

**Commit:** `feat: add per-user daily usage tracking module`

---

## Task 2: Gate the Summary Endpoint

**Files:**
- Modify: `app/api/summary/route.ts`

**What it does:** Check usage before generating summary. Return 402 if limit exceeded. Identify user via optional Clerk auth or extension token.

**Changes:**

1. Add imports for usage tracking and Clerk auth
2. After rate limit check, extract userId from Clerk (optional) or `Authorization` header
3. Look up user plan from Clerk metadata
4. Check usage — if not allowed, return 402
5. After successful response, increment usage

```typescript
// Add to top of app/api/summary/route.ts
import { auth, clerkClient } from '@clerk/nextjs/server';
import { checkUsage, incrementUsage, getUserPlan } from '@/lib/usage';

// After rate limit check, before OpenAI call:
const { userId } = await auth();

let plan: 'free' | 'pro' = 'free';
if (userId) {
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  plan = getUserPlan(user.publicMetadata);
}

const usage = await checkUsage(userId, 'summary', plan);
if (!usage.allowed) {
  return NextResponse.json(
    {
      error: 'Daily summary limit reached. Upgrade to Pro for unlimited summaries.',
      upgrade: true,
      used: usage.used,
      limit: usage.limit,
    },
    { status: 402 }
  );
}

// ... existing OpenAI call ...

// After successful response, before return:
await incrementUsage(userId, 'summary');
```

**Important:** The summary endpoint is public (no auth required). If no userId, usage is tracked by IP as 'anon'. This means unauthenticated users share a pool — incentive to sign in.

**Commit:** `feat: gate summary endpoint with daily usage limits`

---

## Task 3: Gate the Chat Extension Endpoint

**Files:**
- Modify: `app/api/chat/extension/route.ts`

**What it does:** Same pattern as Task 2 but for chat messages.

**Changes:** Same as summary endpoint but with `'chat'` feature key.

```typescript
// Add imports
import { auth, clerkClient } from '@clerk/nextjs/server';
import { checkUsage, incrementUsage, getUserPlan } from '@/lib/usage';

// After rate limit, before OpenAI:
const { userId } = await auth();

let plan: 'free' | 'pro' = 'free';
if (userId) {
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  plan = getUserPlan(user.publicMetadata);
}

const usage = await checkUsage(userId, 'chat', plan);
if (!usage.allowed) {
  return NextResponse.json(
    {
      error: 'Daily chat limit reached. Upgrade to Pro for unlimited chat.',
      upgrade: true,
      used: usage.used,
      limit: usage.limit,
    },
    { status: 402 }
  );
}

// ... existing chat logic ...

// After successful response:
await incrementUsage(userId, 'chat');
```

**Commit:** `feat: gate chat extension endpoint with daily usage limits`

---

## Task 4: Usage Status Endpoint

**Files:**
- Create: `app/api/usage/route.ts`
- Modify: `middleware.ts` — add `/api/usage` to public routes

**What it does:** Returns current usage for the authenticated user. Extension polls this to show remaining quota.

```typescript
// app/api/usage/route.ts
import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { checkUsage, getUserPlan } from '@/lib/usage';

export async function GET() {
  const { userId } = await auth();

  let plan: 'free' | 'pro' = 'free';
  if (userId) {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    plan = getUserPlan(user.publicMetadata);
  }

  const [summary, chat] = await Promise.all([
    checkUsage(userId, 'summary', plan),
    checkUsage(userId, 'chat', plan),
  ]);

  return NextResponse.json({
    plan,
    summary: { used: summary.used, limit: summary.limit, remaining: summary.remaining },
    chat: { used: chat.used, limit: chat.limit, remaining: chat.remaining },
  });
}
```

**Middleware update:** Add `'/api/usage'` to `isPublicRoute` array in `middleware.ts`.

**Commit:** `feat: add usage status endpoint`

---

## Task 5: Stripe Setup and Checkout Endpoint

**Files:**
- Create: `app/api/stripe/checkout/route.ts`
- Create: `app/api/webhooks/stripe/route.ts`
- Modify: `middleware.ts` — add stripe webhook to public routes

**Prerequisites:**
1. `npm install stripe`
2. Create Stripe product "Transcript Tool Pro" with $5/month price in Stripe Dashboard
3. Add env vars: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO`

**Checkout endpoint** — creates a Stripe checkout session:

```typescript
// app/api/stripe/checkout/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: process.env.STRIPE_PRICE_PRO, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://youtube-transcript-service-two.vercel.app'}/pricing?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://youtube-transcript-service-two.vercel.app'}/pricing?canceled=true`,
    metadata: { clerkUserId: userId },
    subscription_data: { metadata: { clerkUserId: userId } },
  });

  return NextResponse.json({ url: session.url });
}
```

**Stripe webhook** — handles subscription changes:

```typescript
// app/api/webhooks/stripe/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { clerkClient } from '@clerk/nextjs/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature')!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const client = await clerkClient();

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      const clerkUserId = subscription.metadata.clerkUserId;
      if (clerkUserId && subscription.status === 'active') {
        await client.users.updateUserMetadata(clerkUserId, {
          publicMetadata: { plan: 'pro' },
        });
      }
      if (clerkUserId && ['canceled', 'unpaid', 'past_due'].includes(subscription.status)) {
        await client.users.updateUserMetadata(clerkUserId, {
          publicMetadata: { plan: 'free' },
        });
      }
      break;
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const clerkUserId = subscription.metadata.clerkUserId;
      if (clerkUserId) {
        await client.users.updateUserMetadata(clerkUserId, {
          publicMetadata: { plan: 'free' },
        });
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
```

**Middleware update:** Add `'/api/webhooks/stripe'` to `isPublicRoute`.

**Commit:** `feat: add Stripe checkout and webhook endpoints`

---

## Task 6: Pricing Page

**Files:**
- Create: `app/pricing/page.tsx`
- Modify: `middleware.ts` — add `/pricing` to public routes

**What it does:** Simple pricing page with Free vs Pro comparison. "Upgrade" button creates checkout session. Shows current plan and usage if signed in.

This is a standard Next.js page. Key elements:
- Two-column pricing card (Free / Pro $5/month)
- Feature comparison list
- "Upgrade to Pro" button that POSTs to `/api/stripe/checkout`
- If already Pro, show "Current plan" badge
- Show current usage (summary X/3, chat X/10) if signed in

**Commit:** `feat: add pricing page`

---

## Task 7: Bridge Clerk Auth to Extension Content Script

**Files:**
- Modify: `extension/src/entrypoints/popup/App.tsx` — save token on sign-in
- Modify: `extension/src/entrypoints/background.ts` — include token in API calls
- Modify: `extension/src/entrypoints/popup/main.tsx` — add token sync listener

**What it does:** When user signs in via the popup, save the Clerk session token to `chrome.storage.local`. Background script reads it and includes as `Authorization: Bearer <token>` header on AI API calls.

**Popup App.tsx changes:**

```typescript
// In App.tsx, add token sync effect:
import { useAuth } from '@clerk/chrome-extension';

export function App() {
  const { getToken, isSignedIn } = useAuth();

  useEffect(() => {
    async function syncToken() {
      if (isSignedIn) {
        const token = await getToken();
        chrome.storage.local.set({ clerkToken: token });
      } else {
        chrome.storage.local.remove('clerkToken');
      }
    }
    syncToken();
  }, [isSignedIn, getToken]);

  // ... rest of component
}
```

**Background.ts changes:**

```typescript
// Helper to get stored token
async function getClerkToken(): Promise<string | null> {
  const result = await chrome.storage.local.get('clerkToken');
  return result.clerkToken || null;
}

// Update SUMMARIZE and CHAT cases to include token in headers
case 'SUMMARIZE': {
  const token = await getClerkToken();
  const data = await fetchSummary(message.markdown, token);
  return { success: true, data };
}
case 'CHAT': {
  const token = await getClerkToken();
  const response = await chatWithVideo(message.videoId, message.message, message.history || [], token);
  return { success: true, response };
}
```

**API lib changes (`extension/src/lib/api.ts`):**

```typescript
// Update fetchSummary and chatWithVideo to accept and forward token:
export async function fetchSummary(markdown: string, token?: string | null) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  // ... rest same
}

export async function chatWithVideo(videoId, message, history, token?: string | null) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  // ... rest same
}
```

**Commit:** `feat: bridge Clerk auth from popup to extension API calls`

---

## Task 8: Extension Upgrade Prompts

**Files:**
- Modify: `extension/src/entrypoints/youtube.content/tabs/SummaryTab.tsx`
- Modify: `extension/src/entrypoints/youtube.content/tabs/ChatTab.tsx`

**What it does:** When API returns 402 (limit reached), show a friendly upgrade message with link to pricing page instead of a generic error.

**Pattern for both tabs:**

```typescript
// In error handling, check for 402/upgrade response:
if (response.error && response.upgrade) {
  // Show upgrade prompt instead of generic error
  setError(null);
  setUpgradePrompt(response.error);
}

// In render, show upgrade prompt:
{upgradePrompt && (
  <div style={{ padding: '16px', textAlign: 'center' }}>
    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
      {upgradePrompt}
    </p>
    <button
      onClick={() => window.open('https://youtube-transcript-service-two.vercel.app/pricing', '_blank')}
      style={{
        padding: '8px 20px',
        fontSize: '13px',
        fontWeight: 500,
        color: '#fff',
        background: 'var(--accent)',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
      }}
    >
      Upgrade to Pro
    </button>
  </div>
)}
```

**Commit:** `feat: show upgrade prompts when usage limits reached`

---

## Implementation Order

1. **Task 1** (usage.ts) — foundation, no dependencies
2. **Task 2** (gate summary) — depends on Task 1
3. **Task 3** (gate chat) — depends on Task 1
4. **Task 4** (usage endpoint) — depends on Task 1
5. **Task 5** (Stripe) — independent, can parallel with 2-4
6. **Task 6** (pricing page) — depends on Task 5
7. **Task 7** (extension auth bridge) — independent, can parallel
8. **Task 8** (upgrade prompts) — depends on Tasks 2-3

Tasks 1-4 can be deployed and tested before Stripe is ready. Users hit free limits → see upgrade message → Stripe comes later.

---

## Environment Variables Needed

```bash
# Stripe (add to Vercel + .env.local)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO=price_...          # Monthly $5 price ID from Stripe Dashboard

# Already configured
UPSTASH_REDIS_REST_URL=...          # For usage tracking
UPSTASH_REDIS_REST_TOKEN=...
CLERK_SECRET_KEY=...                # For user metadata
```

## Stripe Dashboard Setup

1. Create product "Transcript Tool Pro"
2. Add price: $5.00/month recurring
3. Copy price ID → `STRIPE_PRICE_PRO`
4. Set up webhook endpoint: `https://youtube-transcript-service-two.vercel.app/api/webhooks/stripe`
5. Subscribe to events: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
6. Copy webhook secret → `STRIPE_WEBHOOK_SECRET`
