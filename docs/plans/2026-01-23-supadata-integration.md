# Supadata.ai Integration Plan

**Mål:** Byta från custom YouTube-scraper till Supadata.ai för pålitlig transkript-hämtning.

**Beslut:**
- Gratis att lägga till transkript (kostnad absorberas)
- Ingen fallback - bara supadata.ai
- API-nyckel redan konfigurerad i Vercel

---

## Task 1: Skapa Supadata API-klient

**Fil:** `lib/supadata.ts`

Skapa en enkel klient för Supadata.ai transcript API:
- `fetchTranscript(videoId)` - Hämta transkript
- Hantera fel och returnera tydliga meddelanden

---

## Task 2: Uppdatera YouTube-modulen

**Fil:** `lib/youtube.ts`

Ändra `fetchTranscript()` att använda supadata istället för `transcript-service.ts`.

---

## Task 3: Testa och verifiera

Verifiera att transkript-hämtning fungerar:
```bash
curl -X POST https://youtube-transcript-service-two.vercel.app/api/transcript \
  -H "Content-Type: application/json" \
  -d '{"url": "https://youtube.com/watch?v=dQw4w9WgXcQ"}'
```

---

## Task 4: Städa upp (valfritt)

Ta bort oanvänd kod i `lib/transcript-service.ts` om allt fungerar.
