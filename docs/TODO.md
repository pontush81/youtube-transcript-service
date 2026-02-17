# TODO - YouTube Transcript Service

## Kodanalys 2026-02-17

Total genomgång av säkerhet, prestanda, arkitektur och kodkvalitet.

---

## ~~🔴 Kritiskt~~ ✅ Fixat 2026-02-17

- [x] **secureCompare timing-attack** — SHA-256 hash normalisering, konsoliderad till lib/admin.ts
- [x] **Rate limiter** — Omskriven från Redis till PostgreSQL, fail-closed vid DB-fel
- [x] **Backfill admin-check** — Kräver admin-roll på POST och GET
- [x] **Embeddings race condition** — DELETE+INSERT wrappat i transaktion
- [x] **Env-validering** — lib/env.ts med tydliga felmeddelanden

## ~~🟡 Högt~~ ✅ Fixat 2026-02-17

- [x] **Prompt injection-skydd** — XML-delimiters i summarize och query-rewriter
- [x] **.env.production.local** — Redan i .gitignore, ej trackad
- [x] **Saknade databasindex** — user_transcripts(video_id), transcript_chunks(blob_url, video_id+created_at)
- [x] **Parallellisera POST /api/transcript** — Title + transcript körs med Promise.allSettled
- [x] **Next.js Image** — Bytt till Image-komponent + remotePatterns i next.config.ts
- [x] **Redis borttaget** — Rate limiting flyttad till PostgreSQL, @upstash/* avinstallerat

### Kvar (högt) ✅ Fixat 2026-02-17
- [x] **N+1 queries** — DB-queries parallelliserade med Promise.all, blob-fetch-fallback borttagen
- [x] **Tester** — Vitest + 40 tester: secureCompare, video-utils, validations, env, chunking, api-response
- [x] **Error responses** — lib/api-response.ts helper, nyckel-routes uppdaterade till `{ success, error }`

---

## 🟢 Medium (nästa sprint)

### Säkerhet
- [ ] **Stärk YouTube URL-regex** - `lib/validations.ts:4-5` — saknar end-anchor, matchar ogiltiga URL:er.
- [ ] **CSP-policy för bred** - `middleware.ts:55` — `unsafe-eval` i script-src. Undersök om det kan tas bort.

### Prestanda
- [ ] **Caching för autentiserade /api/transcripts** — `no-cache` för inloggade användare. Byt till `private, max-age=300`.
- [ ] **IVFFlat index drop blockar queries** - `lib/db-schema.ts:139-144` — använd `CREATE INDEX CONCURRENTLY`.
- [ ] **Timeouts på externa API-anrop** — Supadata, YouTube oEmbed, OpenAI har inga timeouts. Kan hänga.
- [ ] **Pagination för /api/transcripts** — Returnerar alla transkript, ingen limit/offset.

### Arkitektur
- [ ] **Ta bort död kod: transcript-service.ts** — Helt ersatt av `supadata.ts`, importeras inte någonstans.
- [ ] **Ta bort NextAuth-tabeller i db-schema.ts** — `accounts`, `sessions`, `verification_tokens` skapas fortfarande men Clerk används.
- [ ] **Konsolidera duplicerad kod** — `secureCompare` finns i 2 filer, rate limit-pattern upprepas i 3+ endpoints, title-extraction duplicerad.
- [ ] **Fixa timestamp-inkonsistens i schema** — `transcript_chunks.created_at` är `TIMESTAMP`, resten använder `TIMESTAMPTZ`.
- [ ] **Hårdkodad ADMIN_EMAIL** - `app/api/webhooks/clerk/route.ts:7` — flytta till env-variabel.

### Kodkvalitet
- [ ] **Strukturerad loggning** — 35+ `console.log/error/warn` utan format, timestamps eller request-IDs. Överväg pino eller liknande.
- [ ] **Foreign key transcript_chunks → video_metadata** — Orphan-chunks om video raderas. Lägg till `ON DELETE CASCADE`.

---

## ⚪ Lågt (nice-to-have)

- [ ] **Clerk production keys** - Byt från development till production
- [ ] **Favicon** - Lägg till favicon
- [ ] **Stripe test → live** - Byt nycklar och skapa produkter i live-läge
- [ ] **Ta bort debug-endpoint** - `/api/debug-transcript` är temporär
- [ ] **Usage history page** - Visa detaljerad användningshistorik
- [ ] **Embedding cache använder svag hash** - `lib/ai/embedding-cache.ts:11-20` — 32-bit hash ger kollisionsrisk, byt till `crypto.createHash('sha256')`
- [ ] **Unused dependencies** - `@auth/pg-adapter` (NextAuth-rest), eventuellt `@clerk/localizations`
- [ ] **API-versionering** - Inget `/api/v1/` prefix, breaking changes drabbar klienter direkt
- [ ] **Webhook GET → POST** - `/api/webhook` använder GET med sidoeffekter

---

## Underhåll
- [x] **Månadsvis cleanup** - Automatiserad via Vercel Cron
  - Körs automatiskt 03:00 den 1:a varje månad
  - Aggregerar data äldre än 3 månader till `usage_monthly`
  - Loggar till `system_logs` tabellen
  - Health check: `GET /api/admin/health` (kräver admin key)
  - Manuell cleanup: `POST /api/admin/cleanup-usage` (preview med GET)

---

## Historik

### Implementerat (2026-01-24)
- ✅ Freemium + subscription pricing model
- ✅ Usage tracking (daily for free, monthly for pro)
- ✅ Stripe subscription checkout
- ✅ UsageDisplay component
- ✅ Pricing page

### Implementerat (2026-01-23)
- ✅ Credit-system med PostgreSQL
- ✅ Stripe checkout för credit-köp
- ✅ Admin skip credits
- ✅ Supadata.ai för transkript
- ✅ Web scraping med Cheerio
- ✅ Unified `/api/add` endpoint
