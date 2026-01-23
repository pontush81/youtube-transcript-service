# Knowledge Base MVP Design

**Datum:** 2026-01-23
**Status:** Draft

## Vision

"Bygg din egen kunskapsbas kring valfritt ämne"

Användaren lägger till innehåll (YouTube-videos, webbartiklar) och får en personlig AI-assistent som kan söka och svara på frågor baserat på det egna materialet.

## Kärnprinciper

- **Ingen manuell organisation** - Användaren dumpar in innehåll, AI:n hittar rätt via semantisk sökning
- **Input är gratis** - Uppmuntra stora kunskapsbaser
- **AI kostar credits** - Alignar kostnad med värde (LLM-anrop)
- **Inga prenumerationer** - Köp credits när du behöver, enklare support

## Produktvarianter

| Variant | Målgrupp | Features |
|---------|----------|----------|
| **Public** | Allmänheten | Single-user, credit-system, Stripe |
| **Team** | Jobbet | Delad kunskapsbas, invite-system, inga credits |

MVP fokuserar på **Public**. Team-features byggs senare.

---

## Innehållskällor

### MVP (nu)
- YouTube (redan implementerat)
- Webbsidor (Cheerio-scraping)

### Framtida (senare)
- PDF-uppladdning
- Podcasts

---

## Användarflöde

```
1. Skapa konto (Clerk)
         ↓
2. Få 20 credits gratis
         ↓
3. Lägg till innehåll (YouTube URL eller webb-URL)
         ↓
4. System extraherar text → chunkar → skapar embeddings
         ↓
5. Användaren söker (gratis, vector search)
   eller chattar (kostar 1 credit per fråga)
         ↓
6. AI svarar med citat från användarens källor
         ↓
7. Credits slut? → Köp mer via Stripe
```

---

## Datamodell

### Ändringar i befintlig tabell

```sql
ALTER TABLE user_transcripts
ADD COLUMN content_type TEXT DEFAULT 'youtube',
ADD COLUMN title TEXT,
ADD COLUMN source_url TEXT,
ADD COLUMN metadata JSONB;

-- content_type: 'youtube', 'web', 'pdf', 'podcast'
-- source_url: Full URL (ersätter video_id-logiken)
-- metadata: Flexibelt per content_type
```

**Metadata-struktur per typ:**

```json
// YouTube
{
  "channel": "3Blue1Brown",
  "duration": "18:42",
  "views": 1500000,
  "thumbnail": "https://..."
}

// Web
{
  "domain": "example.com",
  "word_count": 2500,
  "scraped_at": "2026-01-23T10:00:00Z"
}
```

### Ny tabell: Credits

```sql
CREATE TABLE user_credits (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance INTEGER DEFAULT 20,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX user_credits_balance_idx ON user_credits (balance) WHERE balance > 0;
```

---

## Credit-system

### Prissättning

| Paket | Credits | Pris | SEK/fråga |
|-------|---------|------|-----------|
| Free | 20 (vid signup) | 0 kr | - |
| Starter | 100 | 49 kr | 0.49 kr |
| Pro | 500 | 149 kr | 0.30 kr |
| Mega | 2000 | 449 kr | 0.22 kr |

### Kostnader

| Operation | Credits |
|-----------|---------|
| Lägg till innehåll | 0 |
| Semantisk sökning | 0 |
| Chat-fråga | 1 |

### Implementation

```typescript
// lib/credits.ts

export async function getCredits(userId: string): Promise<number> {
  const result = await sql`
    SELECT balance FROM user_credits WHERE user_id = ${userId}
  `;
  return result.rows[0]?.balance ?? 0;
}

export async function useCredit(userId: string): Promise<boolean> {
  const result = await sql`
    UPDATE user_credits
    SET balance = balance - 1, updated_at = NOW()
    WHERE user_id = ${userId} AND balance > 0
    RETURNING balance
  `;
  return result.rows.length > 0;
}

export async function addCredits(userId: string, amount: number): Promise<void> {
  await sql`
    INSERT INTO user_credits (user_id, balance)
    VALUES (${userId}, ${amount})
    ON CONFLICT (user_id)
    DO UPDATE SET balance = user_credits.balance + ${amount}, updated_at = NOW()
  `;
}
```

---

## Web Scraping

### Tekniskt val

**Cheerio** - Snabb, enkel, ingen headless browser. Täcker ~80% av artiklar/bloggar.

Puppeteer kan läggas till senare för JS-renderade sidor om det behövs.

### Implementation

```typescript
// lib/web-scraper.ts

import * as cheerio from 'cheerio';

export interface ScrapedContent {
  title: string;
  content: string;
  url: string;
  wordCount: number;
}

export async function scrapeUrl(url: string): Promise<ScrapedContent> {
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);

  // Ta bort oönskat innehåll
  $('script, style, nav, footer, header, aside, .ads, .comments').remove();

  // Extrahera titel
  const title = $('title').text().trim()
    || $('h1').first().text().trim()
    || 'Untitled';

  // Extrahera huvudinnehåll
  const content = $('article').text().trim()
    || $('main').text().trim()
    || $('body').text().trim();

  // Rensa whitespace
  const cleanedContent = content.replace(/\s+/g, ' ').trim();

  return {
    title,
    content: cleanedContent,
    url,
    wordCount: cleanedContent.split(/\s+/).length,
  };
}
```

### URL-detektion

```typescript
// lib/url-detector.ts

export type ContentType = 'youtube' | 'web';

export function detectContentType(url: string): ContentType {
  const youtubePatterns = [
    /youtube\.com\/watch/,
    /youtu\.be\//,
    /youtube\.com\/embed/,
  ];

  return youtubePatterns.some(p => p.test(url)) ? 'youtube' : 'web';
}
```

---

## Stripe Integration

### Produkter i Stripe

Skapa tre Products med Prices:
- `credits_100` - 49 kr (one-time)
- `credits_500` - 149 kr (one-time)
- `credits_2000` - 449 kr (one-time)

### Checkout Flow

```typescript
// app/api/checkout/route.ts

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const CREDIT_PACKAGES = {
  starter: { priceId: 'price_xxx', credits: 100 },
  pro: { priceId: 'price_yyy', credits: 500 },
  mega: { priceId: 'price_zzz', credits: 2000 },
};

export async function POST(request: Request) {
  const { userId, package: pkg } = await request.json();
  const creditPackage = CREDIT_PACKAGES[pkg];

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{ price: creditPackage.priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_URL}/credits?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_URL}/credits?canceled=true`,
    metadata: { userId, credits: creditPackage.credits.toString() },
  });

  return Response.json({ url: session.url });
}
```

### Webhook

```typescript
// app/api/webhooks/stripe/route.ts

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature')!;

  const event = stripe.webhooks.constructEvent(
    body,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!
  );

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { userId, credits } = session.metadata;
    await addCredits(userId, parseInt(credits));
  }

  return new Response('OK');
}
```

---

## API-ändringar

### POST /api/add (ny endpoint)

Ersätter/utökar `/api/transcript` för att hantera alla content types.

```typescript
// Request
{ url: string }

// Response
{
  success: true,
  contentType: 'youtube' | 'web',
  title: string,
  id: string
}
```

### GET /api/chat (uppdatera)

Lägg till credit-check:

```typescript
// Före chat-logik
const hasCredit = await useCredit(userId);
if (!hasCredit) {
  return Response.json(
    { error: 'No credits remaining', code: 'NO_CREDITS' },
    { status: 402 }
  );
}
```

### GET /api/credits (ny endpoint)

```typescript
// Response
{ balance: number }
```

---

## UI-ändringar

### Huvudsida

- Ändra från "YouTube URL" till "Klistra in URL (YouTube eller webbsida)"
- Visa content type-ikon efter tillägg (video-ikon / globe-ikon)

### Header/Navigation

- Visa credit-balance: "23 credits"
- Länk till köp-sida vid låg balance

### Chat-sida

- Visa credit-kostnad: "1 credit per fråga"
- Vid 0 credits: Disable input, visa "Köp credits för att fortsätta"

### Ny sida: /credits

- Visa current balance
- Tre köp-knappar (Starter/Pro/Mega)
- Stripe checkout redirect

---

## Filstruktur (nya/ändrade filer)

```
lib/
├── credits.ts              # NY: Credit-hantering
├── web-scraper.ts          # NY: Cheerio scraping
├── url-detector.ts         # NY: YouTube vs Web
└── transcript-service.ts   # ÄNDRA: Använd url-detector

app/api/
├── add/route.ts            # NY: Unified content adding
├── credits/route.ts        # NY: Get balance
├── checkout/route.ts       # NY: Stripe checkout
├── webhooks/stripe/route.ts # NY: Stripe webhook
├── chat/route.ts           # ÄNDRA: Credit check
└── db/migrate-credits/route.ts # NY: Migration

app/
├── credits/page.tsx        # NY: Köp credits
└── page.tsx                # ÄNDRA: URL input för båda typer

components/
└── credit-display.tsx      # NY: Visar balance i header
```

---

## Miljövariabler (nya)

```env
# Stripe
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...

# Feature flags
EDITION=public  # 'public' | 'team'
```

---

## Exkluderat från MVP

Följande byggs INTE nu:

- [ ] Team-features (delad kunskapsbas, invites)
- [ ] PDF-uppladdning
- [ ] Podcast-stöd
- [ ] Credit-transaktionshistorik
- [ ] Månadsreset av credits
- [ ] Puppeteer för JS-renderade sidor
- [ ] Content type-filtrering i sökning

---

## Implementation Order

1. **Databasmigrering** - Lägg till kolumner och credits-tabell
2. **Credit-system** - `lib/credits.ts` + `/api/credits`
3. **Web scraper** - `lib/web-scraper.ts` + tester
4. **URL detector** - `lib/url-detector.ts`
5. **Unified add endpoint** - `/api/add`
6. **Uppdatera chat** - Credit-check
7. **Stripe integration** - Checkout + webhook
8. **UI-uppdateringar** - Credit display, köp-sida, input-ändringar

---

## Öppna frågor

1. **Ska befintliga användare få 20 credits?** - Förmodligen ja, via migration
2. **Rate limiting på scraping?** - Kanske 10 URLs/minut för att undvika missbruk
3. **Max storlek på scrapad sida?** - Förslag: 50,000 tecken, trunkera resten
