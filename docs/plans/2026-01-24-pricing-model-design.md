# Pricing Model Design

## Overview

Ersätt nuvarande credit-system med en enklare freemium + subscription-modell.

## Prismodell

### Free Tier
- **3 chats per dag** (räknas per användare)
- **3 transkript per dag**
- Ingen registrering krävs för att testa
- Registrering krävs för att spara transkript

### Pro (99 kr/månad)
- **100 transkript per månad**
- **300 AI-chats per månad**
- Sparade transkript i din kunskapsbas
- Prioriterad support

### Varför dessa gränser?

**Kostnadskalkyl:**
- Supadata: $0.0004/transkript → 100 st = $0.04
- OpenAI: ~$0.003/chat → 300 st = $0.90
- **Total maxkostnad per Pro-användare: ~$1/månad**
- **Marginal vid 99 kr (~$9): ~89%**

**Gränserna känns generösa** för normala användare men skyddar mot missbruk.

## Databasändringar

### Ny tabell: `usage`
```sql
CREATE TABLE usage (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  usage_type TEXT NOT NULL,  -- 'transcript' | 'chat'
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_usage_user_date ON usage(user_id, created_at);
```

### Ny tabell: `subscriptions`
```sql
CREATE TABLE subscriptions (
  id SERIAL PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  status TEXT NOT NULL,  -- 'active' | 'canceled' | 'past_due'
  current_period_end TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Behåll `user_credits` (för migrering)
Existerande credits kan konverteras till Pro-dagar eller refunderas.

## API-ändringar

### Ny: `GET /api/usage`
Returnerar användarens nuvarande användning och gränser.

```typescript
interface UsageResponse {
  plan: 'free' | 'pro';
  period: { start: string; end: string };
  usage: {
    transcripts: { used: number; limit: number };
    chats: { used: number; limit: number };
  };
  subscription?: {
    status: string;
    renewsAt: string;
  };
}
```

### Ny: `POST /api/subscribe`
Skapar Stripe Checkout för Pro-prenumeration.

### Uppdatera: `POST /api/chat`
- Kolla `usage` istället för `credits`
- Logga varje chat i `usage`

### Uppdatera: `POST /api/add`
- Kolla `usage` istället för `credits`
- Logga varje transkript i `usage`

## Stripe-ändringar

### Ny produkt: "Pro Subscription"
- Pris: 99 kr/månad
- Billing: Recurring monthly

### Webhook-events att hantera:
- `customer.subscription.created` → Aktivera Pro
- `customer.subscription.updated` → Uppdatera status
- `customer.subscription.deleted` → Nedgradera till Free
- `invoice.payment_failed` → Markera som past_due

## UI-ändringar

### Ersätt credits-visning med usage-visning
```
Free: 3/5 chats idag | Uppgradera till Pro →
Pro:  847/1000 chats denna månad
```

### Ny: Subscription-hantering
- Visa nuvarande plan
- Uppgradera/nedgradera
- Hantera betalningsmetod (Stripe Customer Portal)

## Migrering

### Steg 1: Skapa nya tabeller
- `usage`
- `subscriptions`

### Steg 2: Migrera existerande credits
- Option A: Konvertera till Pro-dagar (100 credits = 1 månad Pro)
- Option B: Behåll som "bonus credits" som används först

### Steg 3: Uppdatera API:er
- Ändra credit-check till usage-check
- Behåll backwards-compatibility under övergång

### Steg 4: Uppdatera UI
- Ny usage-display
- Ny prenumerationssida

### Steg 5: Ta bort gammalt
- Deprecate credit-endpoints
- Ta bort credit-köpsida

## Framtida utbyggnad

### Usage History (nästa steg)
- Visa historik per dag/vecka/månad
- Exportera användningsdata

### Paste Text Fallback
- Alternativ input när web scraping misslyckas
- Räknas mot samma gränser

### Team/Enterprise
- Delad kunskapsbas
- Admin-dashboard
- Volume pricing

## Implementationsordning

1. **Databas**: Skapa `usage` och `subscriptions` tabeller
2. **Lib**: Skapa `lib/usage.ts` och `lib/subscription.ts`
3. **API**: Uppdatera `/api/chat` och `/api/add` med usage-check
4. **Stripe**: Skapa subscription-produkt och webhook-hantering
5. **UI**: Usage-display och prenumerationssida
6. **Migrering**: Konvertera existerande credit-användare
