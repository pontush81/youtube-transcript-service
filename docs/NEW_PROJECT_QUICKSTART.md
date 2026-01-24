# Snabbstart: Nytt Projekt

## 1. Skapa Projekt

```bash
npx create-next-app@latest my-saas \
  --typescript \
  --tailwind \
  --app \
  --src-dir=false \
  --import-alias="@/*"

cd my-saas
```

## 2. Installera Dependencies

```bash
# Core
npm install @clerk/nextjs stripe @neondatabase/serverless zod

# UI
npm install lucide-react

# AI (om du behöver)
npm install openai
```

## 3. Kopiera Filer från TubeBase

```bash
# Från youtube-transcript-service/

# Database
cp lib/db.ts my-saas/lib/
cp lib/db-schema.ts my-saas/lib/

# Auth & Usage
cp lib/admin.ts my-saas/lib/
cp lib/usage.ts my-saas/lib/
cp lib/rate-limit.ts my-saas/lib/
cp lib/validations.ts my-saas/lib/

# Middleware
cp middleware.ts my-saas/

# Webhooks
mkdir -p my-saas/app/api/webhooks/clerk
mkdir -p my-saas/app/api/webhooks/stripe
cp app/api/webhooks/clerk/route.ts my-saas/app/api/webhooks/clerk/
cp app/api/webhooks/stripe/route.ts my-saas/app/api/webhooks/stripe/

# Subscription
cp app/api/subscribe/route.ts my-saas/app/api/subscribe/
cp app/api/billing-portal/route.ts my-saas/app/api/billing-portal/
cp app/api/usage/route.ts my-saas/app/api/usage/

# Components
cp -r components/NavHeader.tsx my-saas/components/
cp -r components/UsageDisplay.tsx my-saas/components/

# Pricing page
cp -r app/pricing my-saas/app/
```

## 4. Environment Variables

Skapa `.env.local`:

```bash
# Database (från Vercel)
DATABASE_URL="postgresql://..."

# Clerk (från clerk.com)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
CLERK_WEBHOOK_SECRET="whsec_..."

# Stripe (från stripe.com)
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_PRICE_PRO_SUBSCRIPTION="price_..."

# App
NEXT_PUBLIC_URL="http://localhost:3000"
ADMIN_KEY="generate-a-random-key"
```

## 5. Database Setup

```sql
-- Kör mot din PostgreSQL

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'user',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE subscriptions (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  status TEXT DEFAULT 'inactive',
  current_period_end TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE usage (
  id SERIAL PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  usage_type TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_usage_user_type ON usage(user_id, usage_type, created_at);
```

## 6. Uppdatera layout.tsx

```tsx
// app/layout.tsx
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
```

## 7. Testa Lokalt

```bash
npm run dev
```

Besök:
- http://localhost:3000 - Landing
- http://localhost:3000/sign-in - Login
- http://localhost:3000/pricing - Pricing

## 8. Deploy till Vercel

```bash
vercel
```

## 9. Konfigurera Webhooks

### Clerk Webhook
1. clerk.com → Webhooks → Add Endpoint
2. URL: `https://your-app.vercel.app/api/webhooks/clerk`
3. Events: `user.created`, `user.updated`, `user.deleted`
4. Kopiera signing secret → `CLERK_WEBHOOK_SECRET`

### Stripe Webhook
1. stripe.com → Developers → Webhooks → Add Endpoint
2. URL: `https://your-app.vercel.app/api/webhooks/stripe`
3. Events: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`
4. Kopiera signing secret → `STRIPE_WEBHOOK_SECRET`

## 10. Skapa Stripe-produkt

1. stripe.com → Products → Add Product
2. Name: "Pro Plan"
3. Price: $X/month (recurring)
4. Kopiera Price ID → `STRIPE_PRICE_PRO_SUBSCRIPTION`

---

## Klart!

Du har nu:
- ✅ Auth (Clerk)
- ✅ Subscriptions (Stripe)
- ✅ Usage tracking
- ✅ Database
- ✅ Pricing page
- ✅ Billing portal

Lägg till din egen funktionalitet!
