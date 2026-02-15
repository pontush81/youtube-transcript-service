# Chrome Extension — Design Document

**Datum:** 2026-02-15
**Status:** Draft
**Inspiration:** Glasp YouTube Summary

## Bakgrund

Glasp har byggt en framgångsrik Chrome-extension (500K+ användare) som visar YouTube-transkript och AI-sammanfattningar direkt på YouTube-sidan. Deras svagheter: inget eget backend, ingen lagring, skickar bara vidare till ChatGPT/Claude, restriktivt free tier (3/dag), $12/mo.

Vår fördel: vi har redan ett komplett backend med lagring (Vercel Blob), vektor-sökning (pgvector), AI-chat (OpenAI), och autentisering (Clerk). Extensionen blir en tunn klient till befintligt API.

## Mål

1. Bygga en Chrome-extension som lever direkt på YouTube-sidor
2. Erbjuda transkript + AI-summary gratis (tillväxtmotor)
3. Monetarisera via lagring/chat (Pro-plan) för att täcka omkostnader
4. Primärt för eget bruk men öppen som freemium-produkt

## Affärsmodell

### Prissättning

| | Gratis | Pro ($5/mån) |
|---|---|---|
| Visa transkript | Obegränsat | Obegränsat |
| AI-sammanfattning | Obegränsat | Obegränsat |
| Spara till bibliotek | - | Obegränsat |
| Chat med video | - | Obegränsat |
| Sök i biblioteket | - | Obegränsat |
| Export (MD, JSON) | Kopiera text | Full export |

### Kostnadsanalys

Gratis-funktioner kostar nästan inget:
- Transkript: hämtas från YouTubes captions (gratis)
- Summary: ett GPT-4o-mini-anrop (~$0.001/st)

Pro-funktioner har löpande kostnader:
- Embeddings: OpenAI embedding API per chunk
- Databas: Neon PostgreSQL (lagring + compute)
- Blob storage: Vercel Blob (markdown-filer)

Modellen säkerställer att användare som kostar pengar också betalar.

### Databas-skalning

Nuvarande setup (Neon PostgreSQL + pgvector) hanterar tillväxt väl:
- Metadata: ~1-2 KB per video
- Embeddings: ~6-12 KB per chunk (1536-dim vektorer)
- PostgreSQL hanterar miljontals rader
- IVFFlat-index optimeras automatiskt baserat på datamängd
- Neon free tier (0.5 GB) räcker för personligt bruk + tidiga användare
- Uppgradera till Launch ($19/mo) vid behov — men då finns intäkter

## Teknisk Arkitektur

### Extension-komponenter

**Manifest V3** (krav för Chrome Web Store)

```
extension/
├── manifest.json           # Manifest V3
├── src/
│   ├── content/            # Content script (injiceras på YouTube)
│   │   ├── index.tsx       # Entry point
│   │   ├── Widget.tsx      # Huvudwidget med flikar
│   │   ├── TranscriptTab.tsx
│   │   ├── SummaryTab.tsx
│   │   └── ChatTab.tsx
│   ├── background/         # Service worker
│   │   └── index.ts        # API-kommunikation, auth, cache
│   ├── popup/              # Klick på extension-ikon
│   │   └── Popup.tsx       # Login/status/inställningar
│   └── shared/
│       ├── api.ts          # API-klient mot befintligt backend
│       ├── auth.ts         # Clerk session-hantering
│       └── types.ts
├── tailwind.config.ts
└── wxt.config.ts           # WXT build config
```

**1. Content Script** — Injiceras på YouTube-videosidor
- Detekterar videosida via URL-mönster
- Lägger till widget i sidopanelen (bredvid recommended videos)
- Renderar Preact-komponenter med Tailwind CSS

**2. Background Service Worker** — Logik och API
- Kommunicerar med befintligt Next.js API
- Hanterar Clerk auth-token
- Cachar transkript och summaries lokalt (chrome.storage)

**3. Popup** — Extension-ikon
- Visa inloggningsstatus
- Snabblänk till webbappens bibliotek
- Inställningar

### Tech Stack (extension)

- **Preact + TypeScript** (~3KB vs Reacts ~40KB)
- **Tailwind CSS** (återanvänd design från webbappen)
- **WXT** (build-framework för Manifest V3, hot reload, bundling)
- **chrome.storage** för lokal cache

### Befintliga API-endpoints som används

Inga nya endpoints behövs:

- `POST /api/transcript` — Hämta transkript
- `POST /api/add` — Spara video till bibliotek
- `POST /api/chat` — AI-chat med sparad video
- `GET /api/transcripts` — Lista sparade videor

## UI/UX Design

### Layout

Widgeten injiceras i YouTubes sidopanel, bredvid recommended videos:

```
┌─────────────────────────────────────────────────┐
│  YouTube Video Player                           │
│                                                 │
│  ┌───────────────────┐  ┌────────────────────┐  │
│  │                   │  │  Extension Widget   │  │
│  │  Video            │  │                    │  │
│  │                   │  │ [Transcript|Summary│  │
│  │                   │  │  |Chat]            │  │
│  └───────────────────┘  │                    │  │
│                         │  (innehåll)        │  │
│  Titel, likes, etc.    │                    │  │
│                         │  ┌──────────────┐  │  │
│  Kommentarer...         │  │  Spara       │  │  │
│                         │  └──────────────┘  │  │
│                         └────────────────────┘  │
└─────────────────────────────────────────────────┘
```

Collapse/expand-knapp uppe till höger för att minimera.

### Flik 1: Transcript

- Transkript med klickbara timestamps (hoppar i videon)
- Aktuellt segment markeras och synkas medan videon spelar
- Språkväljare om videon har flera caption-spår
- Kopiera eller ladda ner som .md
- **Alltid gratis, ingen inloggning krävs**

### Flik 2: Summary

- Genereras on-demand (klick på "Sammanfatta video")
- Visar: Key Takeaways (bullet points) + Sammanfattning (prosa)
- Cachas lokalt i extensionen (samma video kostar inte dubbelt)
- Kopiera-knapp
- **Alltid gratis, ingen inloggning krävs**

### Flik 3: Chat

- Kräver Pro + att videon är sparad (embeddings måste finnas)
- Kompakt chat-vy med input-fält
- Pratar med befintligt `/api/chat`-endpoint
- **Pro-feature**

### Spara-knappen (alltid synlig längst ner)

- Ej inloggad → "Logga in för att spara"
- Free user → "Uppgradera till Pro"
- Pro user → "Spara till bibliotek" / "Sparad"

### States

| State | Transcript | Summary | Chat | Spara |
|---|---|---|---|---|
| Ej inloggad | Gratis | Gratis | Låst | Låst |
| Free user | Gratis | Gratis | Låst | Låst |
| Pro user | Gratis | Gratis | Full | Full |

### Inloggningsflöde

```
Klick "Logga in" i extensionen
    ↓
Öppnar popup-fönster → webbappen /login (Clerk)
    ↓
Clerk autentiserar (Google, email, etc.)
    ↓
Callback sparar session-token i chrome.storage
    ↓
Extensionen uppdateras → inloggad state
```

### Upgrade-flöde

```
Klick "Uppgradera till Pro"
    ↓
Öppnar webbappen /pricing
    ↓
Betalning (Stripe eller liknande)
    ↓
Webhook uppdaterar användarens roll i databasen
    ↓
Extensionen hämtar ny status → Pro-state
```

## Differentiering vs Glasp

| | Glasp | Vår extension |
|---|---|---|
| Pris | $12/mo | $5/mo |
| Free tier | 3 summaries/dag | Obegränsat transcript + summary |
| Eget bibliotek | Nej (bara highlights) | Ja, sökbart med vektor-sökning |
| Chat med video | Nej | Ja (Pro) |
| AI-modell | Skickar till extern tjänst | Eget backend (GPT-4o-mini) |
| Sök över alla videor | Nej | Ja (Pro) |
| Export | Notion, Obsidian, etc. | Markdown, JSON |

## Öppna frågor

- [ ] Betalningslösning: Stripe? Annan?
- [ ] Namn/branding för extensionen?
- [ ] Chrome Web Store-publicering: developer account ($5 engångsavgift)
- [ ] Ska extensionen även fungera på andra video-sidor (Vimeo, etc.)?
- [ ] Offline-läge: visa cachade transkript utan internet?
