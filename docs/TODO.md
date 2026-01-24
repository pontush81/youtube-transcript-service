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
  - `STRIPE_SECRET_KEY` → `sk_live_...`
  - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` → `pk_live_...`
  - `STRIPE_WEBHOOK_SECRET` → Skapa ny webhook i live-läge och använd den secreten (måste matcha rätt miljö)
  - `STRIPE_PRICE_PRO_SUBSCRIPTION` → Skapa produkt i live-läge
- [ ] **Ta bort debug-endpoint** - `/api/debug-transcript` är temporär
- [ ] **Usage history page** - Visa detaljerad användningshistorik

---

### Underhåll
- [x] **Månadsvis cleanup** - Automatiserad via Vercel Cron
  - Körs automatiskt 03:00 den 1:a varje månad
  - Aggregerar data äldre än 3 månader till `usage_monthly`
  - Loggar till `system_logs` tabellen
  - Health check: `GET /api/admin/health` (kräver admin key)
  - Manuell cleanup: `POST /api/admin/cleanup-usage` (preview med GET)

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
