# TODO - Knowledge Base

## Nästa steg

### Prioritet 1: Produktion-redo
- [ ] **Upstash Redis** - Rate-limiting (gratis tier räcker)
  - Skapa konto på https://upstash.com
  - Lägg till `UPSTASH_REDIS_REST_URL` och `UPSTASH_REDIS_REST_TOKEN` i Vercel

- [ ] **Clerk production keys** - Byt från development till production
  - Clerk Dashboard → API Keys → Production
  - Uppdatera `CLERK_SECRET_KEY` och `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` i Vercel

### Prioritet 2: UX-förbättringar
- [ ] **CreditDisplay i navbar** - Visa credits-saldo i header
  - Importera `CreditDisplay` från `components/CreditDisplay.tsx`
  - Lägg till i `NavHeader.tsx`

- [ ] **Favicon** - Lägg till favicon (404-fel i konsolen)

### Prioritet 3: Nice-to-have
- [ ] **Stripe test → live** - Byt till riktiga Stripe-nycklar när redo
- [ ] **Ta bort debug-endpoint** - `/api/debug-transcript` är temporär

---

## Implementerat (2026-01-23)
- ✅ Credit-system med PostgreSQL
- ✅ Stripe checkout för credit-köp
- ✅ Admin skip credits
- ✅ Supadata.ai för transkript
- ✅ Web scraping med Cheerio
- ✅ Unified `/api/add` endpoint
