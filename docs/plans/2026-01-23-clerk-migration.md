# Clerk Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrera från NextAuth.js med Google OAuth/Email Magic Links till Clerk för förenklad autentisering.

**Architecture:** Clerk hanterar all autentisering via sin hosted UI och webhooks synkar användardata till vår PostgreSQL-databas. Vi behåller `user_transcripts`-tabellen men förenklar `users`-tabellen till att bara spegla Clerk-data.

**Tech Stack:** Clerk SDK (`@clerk/nextjs`), Clerk Webhooks, Vercel Postgres

---

## Förberedelser

### Task 0: Skapa Clerk-konto och konfigurera

**Manuella steg (görs i Clerk Dashboard):**

1. Gå till https://clerk.com och skapa konto
2. Skapa ny applikation "YouTube Transcript Service"
3. Under "User & Authentication" → "Email, Phone, Username":
   - Aktivera Email address (required)
   - Aktivera Email verification (required)
4. Under "User & Authentication" → "Social Connections":
   - Aktivera Google OAuth
   - Kopiera Clerk's redirect URI och konfigurera i Google Cloud Console
5. Under "Developers" → "API Keys":
   - Kopiera `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - Kopiera `CLERK_SECRET_KEY`
6. Under "Developers" → "Webhooks":
   - Skapa webhook endpoint: `https://youtube-transcript-service-two.vercel.app/api/webhooks/clerk`
   - Välj events: `user.created`, `user.updated`, `user.deleted`
   - Kopiera `CLERK_WEBHOOK_SECRET`

**Lägg till i Vercel Environment Variables:**
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
CLERK_WEBHOOK_SECRET=whsec_...
```

---

## Phase 1: Installera Clerk och grundläggande setup

### Task 1: Installera Clerk-paket

**Files:**
- Modify: `package.json`

**Step 1: Installera Clerk**

```bash
npm install @clerk/nextjs svix
```

**Step 2: Verifiera installation**

```bash
npm list @clerk/nextjs svix
```
Expected: Visar installerade versioner

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add Clerk SDK and svix for webhook verification"
```

---

### Task 2: Skapa Clerk-miljövariabler lokalt

**Files:**
- Modify: `.env.local`

**Step 1: Lägg till Clerk-variabler**

Lägg till dessa rader i `.env.local`:
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...
```

**Step 2: Verifiera att env-filen laddas**

```bash
grep CLERK .env.local
```
Expected: Visar de tre CLERK-variablerna

**Step 3: Commit (skippa - env.local är gitignored)**

---

### Task 3: Konfigurera ClerkProvider

**Files:**
- Create: `app/providers.tsx`
- Modify: `app/layout.tsx`

**Step 1: Skapa ny providers.tsx med ClerkProvider**

Skapa `app/providers.tsx`:
```tsx
'use client';

import { ClerkProvider } from '@clerk/nextjs';
import { svSE } from '@clerk/localizations';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider localization={svSE}>
      {children}
    </ClerkProvider>
  );
}
```

**Step 2: Uppdatera layout.tsx**

I `app/layout.tsx`, ersätt SessionProvider-import och användning med Providers:

```tsx
import { Providers } from './providers';

// I return-statement, wrappa children:
<Providers>
  {children}
</Providers>
```

Ta bort:
- `import { SessionProvider } from 'next-auth/react'`
- Eller om det finns en Providers-komponent, uppdatera den

**Step 3: Verifiera att appen startar**

```bash
npm run dev
```
Expected: Appen startar utan fel på http://localhost:3000

**Step 4: Commit**

```bash
git add app/providers.tsx app/layout.tsx
git commit -m "feat: add ClerkProvider with Swedish localization"
```

---

### Task 4: Konfigurera Clerk middleware

**Files:**
- Modify: `middleware.ts`

**Step 1: Ersätt nuvarande middleware med Clerk**

Ersätt hela `middleware.ts` med:
```typescript
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isProtectedRoute = createRouteMatcher(['/chat(.*)']);
const isAuthRoute = createRouteMatcher(['/login(.*)']);

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();

  // Redirect authenticated users away from login
  if (isAuthRoute(req) && userId) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  // Protect /chat route
  if (isProtectedRoute(req) && !userId) {
    return NextResponse.redirect(new URL('/sign-in', req.url));
  }

  // Add security headers
  const response = NextResponse.next();

  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains'
    );
  }

  return response;
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
```

**Step 2: Verifiera middleware fungerar**

```bash
npm run dev
```

Testa:
1. Besök http://localhost:3000 - ska fungera
2. Besök http://localhost:3000/chat - ska redirecta till /sign-in

**Step 3: Commit**

```bash
git add middleware.ts
git commit -m "feat: replace NextAuth middleware with Clerk middleware"
```

---

## Phase 2: Skapa Clerk auth-sidor

### Task 5: Skapa Sign-in sida

**Files:**
- Create: `app/sign-in/[[...sign-in]]/page.tsx`

**Step 1: Skapa sign-in route**

```bash
mkdir -p app/sign-in/[[...sign-in]]
```

**Step 2: Skapa sign-in page**

Skapa `app/sign-in/[[...sign-in]]/page.tsx`:
```tsx
import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <SignIn
        appearance={{
          elements: {
            rootBox: 'mx-auto',
            card: 'shadow-lg',
          }
        }}
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
      />
    </div>
  );
}
```

**Step 3: Verifiera sidan**

```bash
npm run dev
```
Besök http://localhost:3000/sign-in
Expected: Clerk sign-in UI visas

**Step 4: Commit**

```bash
git add app/sign-in
git commit -m "feat: add Clerk sign-in page"
```

---

### Task 6: Skapa Sign-up sida

**Files:**
- Create: `app/sign-up/[[...sign-up]]/page.tsx`

**Step 1: Skapa sign-up route**

```bash
mkdir -p app/sign-up/[[...sign-up]]
```

**Step 2: Skapa sign-up page**

Skapa `app/sign-up/[[...sign-up]]/page.tsx`:
```tsx
import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <SignUp
        appearance={{
          elements: {
            rootBox: 'mx-auto',
            card: 'shadow-lg',
          }
        }}
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
      />
    </div>
  );
}
```

**Step 3: Verifiera sidan**

```bash
npm run dev
```
Besök http://localhost:3000/sign-up
Expected: Clerk sign-up UI visas

**Step 4: Commit**

```bash
git add app/sign-up
git commit -m "feat: add Clerk sign-up page"
```

---

## Phase 3: Uppdatera UI-komponenter

### Task 7: Uppdatera NavHeader med Clerk

**Files:**
- Modify: `components/NavHeader.tsx`

**Step 1: Läs nuvarande NavHeader**

Läs filen för att förstå strukturen.

**Step 2: Ersätt NextAuth hooks med Clerk**

Uppdatera imports och hooks:
```tsx
'use client';

import { useUser, useClerk, SignedIn, SignedOut, UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function NavHeader() {
  const { user, isLoaded } = useUser();
  const pathname = usePathname();

  const navItems = [
    { href: '/', label: 'Hem' },
    { href: '/transcripts', label: 'Transkript' },
    { href: '/chat', label: 'Chat', protected: true },
  ];

  return (
    <header className="bg-white shadow-sm border-b">
      <nav className="max-w-4xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="font-semibold text-lg">
              YT Transcript
            </Link>
            <div className="flex gap-4">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`text-sm ${
                    pathname === item.href
                      ? 'text-blue-600 font-medium'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {item.label}
                  {item.protected && !user && ' 🔒'}
                </Link>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <SignedOut>
              <Link
                href="/sign-in"
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Logga in
              </Link>
            </SignedOut>
            <SignedIn>
              <UserButton
                afterSignOutUrl="/"
                appearance={{
                  elements: {
                    avatarBox: 'w-8 h-8'
                  }
                }}
              />
            </SignedIn>
          </div>
        </div>
      </nav>
    </header>
  );
}
```

**Step 3: Verifiera**

```bash
npm run dev
```

Testa:
1. Se att navbar visas korrekt
2. Logga in via /sign-in
3. Se att UserButton visas efter inloggning

**Step 4: Commit**

```bash
git add components/NavHeader.tsx
git commit -m "feat: update NavHeader to use Clerk components"
```

---

### Task 8: Ta bort gamla login-sidor

**Files:**
- Delete: `app/login/page.tsx`
- Delete: `app/login/verify/page.tsx`
- Delete: `app/login/` (hela mappen)

**Step 1: Ta bort login-mappen**

```bash
rm -rf app/login
```

**Step 2: Verifiera att de är borta**

```bash
ls app/ | grep login
```
Expected: Inget output

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove old NextAuth login pages"
```

---

## Phase 4: Uppdatera API-routes

### Task 9: Skapa Clerk webhook endpoint

**Files:**
- Create: `app/api/webhooks/clerk/route.ts`

**Step 1: Skapa webhook-mapp**

```bash
mkdir -p app/api/webhooks/clerk
```

**Step 2: Skapa webhook handler**

Skapa `app/api/webhooks/clerk/route.ts`:
```typescript
import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server';
import { sql } from '@vercel/postgres';

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    throw new Error('Please add CLERK_WEBHOOK_SECRET to environment variables');
  }

  // Get headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Missing svix headers', { status: 400 });
  }

  // Get body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Verify webhook
  const wh = new Webhook(WEBHOOK_SECRET);
  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error('Webhook verification failed:', err);
    return new Response('Webhook verification failed', { status: 400 });
  }

  // Handle events
  const eventType = evt.type;

  if (eventType === 'user.created' || eventType === 'user.updated') {
    const { id, email_addresses, first_name, last_name, image_url } = evt.data;

    const email = email_addresses?.[0]?.email_address;
    const name = [first_name, last_name].filter(Boolean).join(' ') || null;

    await sql`
      INSERT INTO users (id, email, name, image, updated_at)
      VALUES (${id}, ${email}, ${name}, ${image_url}, NOW())
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        name = EXCLUDED.name,
        image = EXCLUDED.image,
        updated_at = NOW()
    `;
  }

  if (eventType === 'user.deleted') {
    const { id } = evt.data;

    // Soft delete or handle as needed
    // For now, we keep user data but could mark as deleted
    await sql`
      UPDATE users SET
        email = NULL,
        name = 'Deleted User',
        updated_at = NOW()
      WHERE id = ${id}
    `;
  }

  return new Response('Webhook processed', { status: 200 });
}
```

**Step 3: Verifiera syntax**

```bash
npx tsc --noEmit app/api/webhooks/clerk/route.ts 2>&1 | head -20
```
Expected: Inga TypeScript-fel

**Step 4: Commit**

```bash
git add app/api/webhooks/clerk
git commit -m "feat: add Clerk webhook endpoint for user sync"
```

---

### Task 10: Uppdatera databas-schema för Clerk

**Files:**
- Modify: `lib/db-schema.sql` (eller skapa om den inte finns)

**Step 1: Skapa migration SQL**

Skapa/uppdatera `lib/db-migrations/002-clerk-migration.sql`:
```sql
-- Clerk uses string IDs (user_xxx format), not UUIDs
-- We need to alter the users table

-- 1. Create new users table for Clerk
CREATE TABLE IF NOT EXISTS users_new (
  id TEXT PRIMARY KEY,  -- Clerk user ID (user_xxx)
  email TEXT,
  name TEXT,
  image TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Migrate existing data if any (skip if fresh install)
-- Note: This will lose the connection since Clerk IDs are different
-- Users will need to re-authenticate

-- 3. Update user_transcripts to reference new ID format
ALTER TABLE user_transcripts
  ALTER COLUMN user_id TYPE TEXT;

-- 4. Drop old NextAuth tables (after confirming migration)
-- DROP TABLE IF EXISTS accounts;
-- DROP TABLE IF EXISTS sessions;
-- DROP TABLE IF EXISTS verification_tokens;
-- DROP TABLE IF EXISTS users;

-- 5. Rename new table
-- ALTER TABLE users_new RENAME TO users;
```

**Step 2: Dokumentera migration**

Notera: Körning av denna migration kräver manuell hantering eftersom:
- Befintliga användare förlorar koppling till sina transkript
- NextAuth sessions blir ogiltiga
- Detta bör göras under planerat underhåll

**Step 3: Commit**

```bash
mkdir -p lib/db-migrations
git add lib/db-migrations/002-clerk-migration.sql
git commit -m "docs: add Clerk database migration script"
```

---

### Task 11: Uppdatera transcripts API route

**Files:**
- Modify: `app/api/transcripts/route.ts`

**Step 1: Läs nuvarande implementation**

Läs filen för att förstå current auth usage.

**Step 2: Ersätt NextAuth auth() med Clerk**

Uppdatera imports och auth-anrop:
```typescript
import { auth } from '@clerk/nextjs/server';

// I GET-funktionen, ersätt:
// const session = await auth();
// const userId = session?.user?.id;

// Med:
const { userId } = await auth();
```

Uppdatera alla `session?.user?.id` till `userId` och `session?.user` checks till `userId` checks.

**Step 3: Verifiera**

```bash
npm run dev
```

Testa:
1. Besök /transcripts som utloggad
2. Logga in och besök /transcripts igen
3. Verifiera att user-specifika transkript visas

**Step 4: Commit**

```bash
git add app/api/transcripts/route.ts
git commit -m "feat: update transcripts API to use Clerk auth"
```

---

### Task 12: Uppdatera chat API route

**Files:**
- Modify: `app/api/chat/route.ts`

**Step 1: Läs nuvarande implementation**

Läs filen för att förstå current structure.

**Step 2: Lägg till Clerk auth check**

```typescript
import { auth } from '@clerk/nextjs/server';

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return new Response('Unauthorized', { status: 401 });
  }

  // ... rest of implementation
}
```

**Step 3: Verifiera**

```bash
npm run dev
```

Testa att /api/chat returnerar 401 för ej inloggade.

**Step 4: Commit**

```bash
git add app/api/chat/route.ts
git commit -m "feat: add Clerk auth check to chat API"
```

---

### Task 13: Uppdatera transcript API route

**Files:**
- Modify: `app/api/transcript/route.ts`

**Step 1: Läs nuvarande implementation**

Läs filen.

**Step 2: Uppdatera till Clerk auth**

Om den använder session för att koppla transkript till användare:
```typescript
import { auth } from '@clerk/nextjs/server';

// Ersätt NextAuth session-hämtning med:
const { userId } = await auth();
```

**Step 3: Verifiera**

Testa att skapa nytt transkript fungerar.

**Step 4: Commit**

```bash
git add app/api/transcript/route.ts
git commit -m "feat: update transcript API to use Clerk auth"
```

---

## Phase 5: Ta bort NextAuth

### Task 14: Ta bort NextAuth-filer och dependencies

**Files:**
- Delete: `lib/auth.ts`
- Delete: `app/api/auth/[...nextauth]/route.ts`
- Delete: `components/Providers.tsx` (om den bara innehöll SessionProvider)
- Modify: `package.json`

**Step 1: Ta bort NextAuth API route**

```bash
rm -rf app/api/auth
```

**Step 2: Ta bort auth.ts**

```bash
rm lib/auth.ts
```

**Step 3: Avinstallera NextAuth**

```bash
npm uninstall next-auth @auth/core
```

**Step 4: Verifiera att appen fungerar**

```bash
npm run dev
```

Testa:
1. Startar utan fel
2. Sign-in fungerar
3. Sign-out fungerar
4. Protected routes fungerar

**Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove NextAuth.js dependencies and files"
```

---

### Task 15: Rensa gamla miljövariabler

**Files:**
- Dokumentation

**Step 1: Lista variabler att ta bort från Vercel**

Dessa kan tas bort från Vercel Environment Variables:
- `AUTH_SECRET`
- `GOOGLE_CLIENT_ID` (Clerk hanterar detta nu)
- `GOOGLE_CLIENT_SECRET` (Clerk hanterar detta nu)
- `RESEND_API_KEY` (Clerk hanterar email nu)
- `EMAIL_FROM` (Clerk hanterar email nu)

**Step 2: Behåll dessa**
- `POSTGRES_URL` - används fortfarande
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - ny
- `CLERK_SECRET_KEY` - ny
- `CLERK_WEBHOOK_SECRET` - ny

**Step 3: Uppdatera .env.example om den finns**

```bash
# Ta bort gamla och lägg till nya Clerk-variabler
```

**Step 4: Commit**

```bash
git add -A
git commit -m "docs: update environment variables for Clerk"
```

---

## Phase 6: Sluttest och deploy

### Task 16: Kör fullständigt test

**Step 1: Kör linter**

```bash
npm run lint
```
Expected: Inga fel

**Step 2: Kör type check**

```bash
npx tsc --noEmit
```
Expected: Inga fel

**Step 3: Kör build**

```bash
npm run build
```
Expected: Build lyckas

**Step 4: Testa manuellt**

1. Starta dev server: `npm run dev`
2. Testa sign-up med email
3. Testa sign-in med email
4. Testa sign-in med Google
5. Testa att /chat är skyddad
6. Testa att skapa transkript
7. Testa att se egna transkript
8. Testa sign-out

**Step 5: Commit om några fixes behövdes**

```bash
git add -A
git commit -m "fix: address issues found in testing"
```

---

### Task 17: Deploy till Vercel

**Step 1: Push till GitHub**

```bash
git push origin main
```

**Step 2: Verifiera Vercel deploy**

Vänta på att Vercel bygger och deployer.

**Step 3: Testa production**

1. Besök https://youtube-transcript-service-two.vercel.app
2. Testa sign-up/sign-in
3. Testa alla funktioner

**Step 4: Konfigurera Clerk webhook i production**

I Clerk Dashboard:
1. Gå till Webhooks
2. Lägg till production endpoint
3. Verifiera att webhooks fungerar

---

## Sammanfattning

### Filer som skapas:
- `app/providers.tsx`
- `app/sign-in/[[...sign-in]]/page.tsx`
- `app/sign-up/[[...sign-up]]/page.tsx`
- `app/api/webhooks/clerk/route.ts`
- `lib/db-migrations/002-clerk-migration.sql`

### Filer som modifieras:
- `package.json`
- `middleware.ts`
- `app/layout.tsx`
- `components/NavHeader.tsx`
- `app/api/transcripts/route.ts`
- `app/api/transcript/route.ts`
- `app/api/chat/route.ts`

### Filer som tas bort:
- `lib/auth.ts`
- `app/api/auth/[...nextauth]/route.ts`
- `app/login/` (hela mappen)
- `components/Providers.tsx` (om den bara hade SessionProvider)

### Nya miljövariabler:
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `CLERK_WEBHOOK_SECRET`

### Miljövariabler att ta bort:
- `AUTH_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `RESEND_API_KEY`
- `EMAIL_FROM`
