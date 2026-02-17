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

## ~~🟢 Medium~~ ✅ Fixat 2026-02-17

### Säkerhet
- [x] **Stärk YouTube URL-regex** — End-anchor tillagd, testad med 4 nya tester
- [x] **CSP-policy för bred** — `unsafe-eval` borttagen i produktion (bara dev), Clerk kräver det inte

### Prestanda
- [x] **Caching för autentiserade /api/transcripts** — Bytt till `private, max-age=300`
- [x] **Timeouts på externa API-anrop** — AbortSignal.timeout på alla fetch: Supadata (30s), YouTube/oEmbed (10s)
- [x] **Pagination för /api/transcripts** — limit/offset med default 100, max 500, total count i response

### Arkitektur
- [x] **Ta bort död kod: transcript-service.ts** — Raderad, ersatt av supadata.ts
- [x] **Ta bort NextAuth-tabeller i db-schema.ts** — Borttagna (accounts, sessions, verification_tokens)
- [x] **Konsolidera duplicerad kod** — secureCompare konsoliderad, fetchVideoMetadataFallback borttagen (duplicerade oEmbed-logik)
- [x] **Fixa timestamp-inkonsistens i schema** — transcript_chunks.created_at ändrad till TIMESTAMPTZ
- [x] **Hårdkodad ADMIN_EMAIL** — Flyttad till env-variabel med fallback

### Kvar (medium)
- [ ] **IVFFlat index drop blockar queries** - `lib/db-schema.ts` — `CREATE INDEX CONCURRENTLY` kräver att det körs utanför transaktion, behöver separat migration-endpoint.
- [ ] **Strukturerad loggning** — 35+ `console.log/error/warn` utan format, timestamps eller request-IDs. Överväg pino eller liknande.
- [ ] **Foreign key transcript_chunks → video_metadata** — Kräver arkitekturändringar: chunks sparas ibland före metadata, FK skulle blockera inserts.

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
