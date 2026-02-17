# TODO - YouTube Transcript Service

## Kodanalys 2026-02-17

Total genomgång av säkerhet, prestanda, arkitektur och kodkvalitet.

---

## 🔴 Kritiskt (fixa först)

### Säkerhet
- [ ] **Fixa secureCompare timing-attack** - `lib/admin.ts:20` jämför buffer med sig själv vid längdskillnad, läcker admin-nyckelns längd. Duplicerad i `app/api/delete/route.ts:10-25` — konsolidera och fixa.
- [ ] **Rate limiter fails open** - `lib/rate-limit.ts:154-160` — vid Redis-fel tillåts requests istället för att blockeras. Byt till fail-closed.
- [ ] **Backfill-endpoint saknar admin-check** - `app/api/metadata/backfill/route.ts:11-20` — autentiserade icke-admin-användare kan trigga dyra YouTube API-anrop.

### Dataintegritet
- [ ] **Race condition i embeddings** - `lib/embeddings.ts:63-66` — DELETE + INSERT utan transaktion. Om INSERT misslyckas förloras data. Wrappa i databas-transaktion.
- [ ] **Env-variabler valideras inte vid start** - Stripe/OpenAI-nycklar använder `!` non-null assertions. Kraschar vid runtime istället för boot. Lägg till startup-validering.

---

## 🟡 Högt (nästa vecka)

### Säkerhet
- [ ] **Prompt injection-skydd** - `app/api/summarize/route.ts:101` och `lib/ai/query-rewriter.ts:54-59` — användarinput bäddas in i AI-prompts utan escaping.
- [ ] **Ta bort .env.production.local från git** — Innehåller test-nycklar (pk_test_). Lägg till i `.gitignore`.

### Prestanda
- [ ] **N+1 queries i /api/transcripts** - `app/api/transcripts/route.ts:112-159` — loopar igenom varje blob med individuella DB-queries och fetch-anrop. Batch-ladda metadata.
- [ ] **Saknade databasindex** — `video_metadata(video_id)`, `user_transcripts(video_id)`, `transcript_chunks(blob_url)`, `transcript_chunks(video_id, created_at)`.
- [ ] **Parallellisera POST /api/transcript** - `app/api/transcript/route.ts:56-93` — title, transcript och save körs sekventiellt men är oberoende. Använd `Promise.all()`.
- [ ] **Använd Next.js Image** - `app/transcripts/page.tsx:530-535` — raw `<img>` utan optimering. Konfigurerar även `next.config.ts` med `remotePatterns` för `i.ytimg.com`.

### Kodkvalitet
- [ ] **Noll tester** — Ingen testkonfiguration, inga testfiler. Lägg till Vitest + tester för kritiska flöden: auth, rate limiting, vector search, embeddings.
- [ ] **Standardisera error responses** — Vissa endpoints returnerar `{ success, error }`, andra bara `{ error }`. Skapa gemensam felhanteringsfunktion.

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
