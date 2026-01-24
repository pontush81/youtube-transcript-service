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
