# Tech Stack Template

> Dokumentation av TubeBase-stacken för återanvändning i framtida projekt.

## Översikt

```
┌─────────────────────────────────────────────────────────┐
│                      Frontend                            │
│  Next.js 16 (App Router) + React 19 + Tailwind CSS v4   │
├─────────────────────────────────────────────────────────┤
│                    Authentication                        │
│                      Clerk                               │
├─────────────────────────────────────────────────────────┤
│                      Backend                             │
│           Next.js API Routes (serverless)               │
├──────────────────┬──────────────────┬───────────────────┤
│    Database      │     Storage      │    Payments       │
│   PostgreSQL     │   Vercel Blob    │     Stripe        │
│   (Neon/Vercel)  │                  │                   │
├──────────────────┴──────────────────┴───────────────────┤
│                        AI                                │
│         OpenAI (GPT-4o-mini + text-embedding-3-small)   │
├─────────────────────────────────────────────────────────┤
│                    Infrastructure                        │
│              Vercel (hosting + edge)                    │
└─────────────────────────────────────────────────────────┘
```

---

## Tech Stack Detaljer

### Frontend

| Tech | Version | Varför |
|------|---------|--------|
| **Next.js** | 16 | App Router, Server Components, API routes i samma projekt |
| **React** | 19 | Senaste med Server Components |
| **TypeScript** | 5.x | Typsäkerhet, bättre DX |
| **Tailwind CSS** | 4 | Utility-first, snabb styling |
| **Lucide React** | - | Konsistenta ikoner |

### Backend & Database

| Tech | Varför |
|------|--------|
| **PostgreSQL** | Relationsdatabas + pgvector för embeddings |
| **Vercel Postgres** | Serverless, auto-scaling, enkelt med Vercel |
| **Vercel Blob** | Fillagring för större content |

### Auth & Payments

| Tech | Varför |
|------|--------|
| **Clerk** | Komplett auth, webhooks, user management, React components |
| **Stripe** | Subscriptions, webhooks, Customer Portal |

### AI

| Tech | Varför |
|------|--------|
| **OpenAI GPT-4o-mini** | Snabb, billig, bra för chat |
| **text-embedding-3-small** | Billiga embeddings för semantic search |
| **pgvector** | Vector similarity search i PostgreSQL |

---

## Projektstruktur

```
project/
├── app/                      # Next.js App Router
│   ├── page.tsx              # Landing page
│   ├── layout.tsx            # Root layout med providers
│   ├── (feature)/            # Feature routes
│   │   └── page.tsx
│   └── api/                   # API routes
│       ├── auth/              # Auth-relaterade endpoints
│       ├── webhooks/          # Clerk & Stripe webhooks
│       │   ├── clerk/route.ts
│       │   └── stripe/route.ts
│       └── [feature]/route.ts
│
├── components/               # React components
│   ├── ui/                   # Generiska UI components
│   └── [feature]/            # Feature-specifika
│
├── lib/                      # Utilities & services
│   ├── db.ts                 # Database connection
│   ├── db-schema.ts          # Schema definitions
│   ├── usage.ts              # Usage tracking & limits
│   ├── rate-limit.ts         # Rate limiting
│   ├── admin.ts              # Admin utilities
│   └── validations.ts        # Zod schemas
│
├── docs/                     # Documentation
│   └── plans/                # Implementation plans
│
├── middleware.ts             # Auth middleware
└── .env.local                # Environment variables
```

---

## Viktiga Patterns

### 1. Database Connection (lib/db.ts)

```typescript
import { neon } from '@neondatabase/serverless';

// Singleton pattern för serverless
const sql = neon(process.env.DATABASE_URL!);

export { sql };
```

### 2. API Route Pattern

```typescript
// app/api/example/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { sql } from '@/lib/db';

export async function GET(request: NextRequest) {
  // 1. Auth check
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Input validation (om POST)
  // const body = await request.json();
  // const parsed = schema.safeParse(body);

  // 3. Business logic
  try {
    const result = await sql`SELECT * FROM table WHERE user_id = ${userId}`;
    return NextResponse.json({ data: result.rows });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

### 3. Clerk Middleware (middleware.ts)

```typescript
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks/(.*)',  // Webhooks måste vara publika
  '/api/public/(.*)',    // Publika API routes
]);

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.redirect(new URL('/sign-in', req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)'],
};
```

### 4. Stripe Webhook Pattern

```typescript
// app/api/webhooks/stripe/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature')!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      // Aktivera subscription
      break;
    case 'customer.subscription.deleted':
      // Avsluta subscription
      break;
    case 'invoice.paid':
      // Förnya period
      break;
  }

  return NextResponse.json({ received: true });
}
```

### 5. Usage Tracking Pattern

```typescript
// lib/usage.ts
export type UsageType = 'chat' | 'transcript' | 'api_call';

export const FREE_LIMITS = {
  perDay: 3,
} as const;

export const PRO_LIMITS = {
  perMonth: -1, // -1 = unlimited
} as const;

export async function canUse(userId: string, type: UsageType): Promise<boolean> {
  const isPro = await isProUser(userId);
  const usage = await getUsage(userId, type, isPro ? 'month' : 'day');
  const limit = isPro ? PRO_LIMITS.perMonth : FREE_LIMITS.perDay;

  return limit === -1 || usage < limit;
}

export async function logUsage(userId: string, type: UsageType): Promise<void> {
  await sql`INSERT INTO usage (user_id, usage_type) VALUES (${userId}, ${type})`;
}
```

### 6. Vector Search Pattern (RAG)

```typescript
// lib/embeddings.ts
import OpenAI from 'openai';

const openai = new OpenAI();

export async function createEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return response.data[0].embedding;
}

export async function searchSimilar(query: string, limit = 5) {
  const embedding = await createEmbedding(query);

  // pgvector cosine similarity search
  const results = await sql`
    SELECT content, 1 - (embedding <=> ${JSON.stringify(embedding)}::vector) as similarity
    FROM chunks
    ORDER BY embedding <=> ${JSON.stringify(embedding)}::vector
    LIMIT ${limit}
  `;

  return results.rows;
}
```

---

## Database Schema Template

```sql
-- Users (synced from Clerk via webhook)
CREATE TABLE users (
  id TEXT PRIMARY KEY,           -- Clerk user ID
  email TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'user',      -- 'user' | 'admin'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Subscriptions (synced from Stripe via webhook)
CREATE TABLE subscriptions (
  id SERIAL PRIMARY KEY,
  user_id TEXT UNIQUE REFERENCES users(id),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  status TEXT DEFAULT 'inactive', -- 'active' | 'canceled' | 'inactive'
  current_period_end TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Usage tracking
CREATE TABLE usage (
  id SERIAL PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  usage_type TEXT NOT NULL,       -- 'chat' | 'transcript' | etc.
  created_at TIMESTAMP DEFAULT NOW()
);

-- Vector embeddings (requires pgvector extension)
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE chunks (
  id SERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  embedding vector(1536),         -- text-embedding-3-small dimension
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX ON chunks USING ivfflat (embedding vector_cosine_ops);
```

---

## Environment Variables

```bash
# .env.local

# Database
DATABASE_URL="postgresql://..."

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
CLERK_WEBHOOK_SECRET="whsec_..."

# Stripe
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_PRICE_ID="price_..."       # Subscription price ID

# OpenAI
OPENAI_API_KEY="sk-..."

# Storage (Vercel Blob)
BLOB_READ_WRITE_TOKEN="vercel_blob_..."

# App
NEXT_PUBLIC_URL="http://localhost:3000"
ADMIN_KEY="your-secret-admin-key"
```

---

## Nytt Projekt Checklist

### 1. Setup

```bash
# Skapa projekt
npx create-next-app@latest my-app --typescript --tailwind --app

# Installera dependencies
npm install @clerk/nextjs stripe @neondatabase/serverless openai zod lucide-react
```

### 2. Vercel Setup

1. Skapa projekt på vercel.com
2. Lägg till Vercel Postgres (Storage → Create Database)
3. Lägg till Vercel Blob (Storage → Create Blob Store)
4. Koppla GitHub repo

### 3. Clerk Setup

1. Skapa app på clerk.com
2. Kopiera API keys till .env.local
3. Skapa webhook: `https://your-app.vercel.app/api/webhooks/clerk`
   - Events: `user.created`, `user.updated`, `user.deleted`

### 4. Stripe Setup

1. Skapa produkt + price på stripe.com
2. Kopiera API keys till .env.local
3. Skapa webhook: `https://your-app.vercel.app/api/webhooks/stripe`
   - Events: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`

### 5. Database Setup

1. Kör schema.sql mot databasen
2. Verifiera connection med test-query

---

## Kostnadsuppskattning (Hobby/Small Scale)

| Tjänst | Free Tier | Paid |
|--------|-----------|------|
| **Vercel** | 100GB bandwidth | $20/mo Pro |
| **Vercel Postgres** | 256MB storage | $0.10/GB |
| **Vercel Blob** | 1GB | $0.15/GB |
| **Clerk** | 10,000 MAU | $0.02/MAU |
| **Stripe** | - | 2.9% + $0.30/tx |
| **OpenAI** | - | ~$0.01/1K tokens |

**Typisk kostnad vid start: $0-20/månad**

---

## Nästa Steg

Använd denna template för:
- [ ] SaaS-produkter med subscription
- [ ] AI-drivna verktyg
- [ ] Dokument/content-hantering
- [ ] Personliga verktyg med auth

---

*Dokumenterat: 2026-01-24*
*Baserat på: TubeBase (youtube-transcript-service)*
