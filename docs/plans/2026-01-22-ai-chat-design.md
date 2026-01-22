# AI Chat för YouTube Transcript Service

## Sammanfattning

En ChatGPT/Claude-liknande chattfunktion som låter användare ställa frågor om sina sparade YouTube-transkript. Chatten kan analysera videor, skapa innehåll baserat på dem, och vid behov komplettera med allmän kunskap.

## Funktioner

### Kärnfunktioner
- **Analysera transkript** - "Vad sa han om X?", "Sammanfatta del 2"
- **Skapa innehåll** - Blogginlägg, sammanfattningar, sociala medier-posts
- **Källhänvisningar** - Tydligt visa vilken video och timestamp info kommer från
- **Mode-toggle** - Växla mellan "endast transkript" och "transkript + allmän kunskap"
- **Video-urval** - Chatta med alla transkript eller ett urval

### Framtida
- Claude som alternativ AI-modell
- Modellväljare i UI

---

## Arkitektur

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Chat UI     │  │ Video-      │  │ Inställningar       │  │
│  │ (messages)  │  │ väljare     │  │ [📹|🌐] toggle      │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     API: /api/chat                           │
│  1. Ta emot fråga + valda transkript + mode                 │
│  2. Söka relevanta stycken (vector search)                  │
│  3. Bygga prompt med kontext + källhänvisningar             │
│  4. Streama svar från AI (OpenAI/Claude)                    │
└─────────────────────────────────────────────────────────────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
       ┌──────────┐  ┌───────────┐  ┌──────────┐
       │ Vercel   │  │ Vercel    │  │ OpenAI/  │
       │ Postgres │  │ Blob      │  │ Claude   │
       │ (vectors)│  │ (filer)   │  │ API      │
       └──────────┘  └───────────┘  └──────────┘
```

### Flöde vid fråga
1. Frontend skickar fråga + valda video-IDs + mode (strikt/hybrid)
2. API gör vector search i Postgres för att hitta relevanta stycken
3. Bygger prompt med de bästa träffarna som kontext
4. Streamar AI-svaret tillbaka med källhänvisningar

---

## Datamodell

### Ny tabell: transcript_chunks

```sql
-- Aktivera pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Transkript-chunks med embeddings
CREATE TABLE transcript_chunks (
  id            UUID PRIMARY KEY,
  blob_url      TEXT NOT NULL,        -- Referens till Vercel Blob
  video_id      TEXT NOT NULL,        -- YouTube video-id
  video_title   TEXT NOT NULL,
  chunk_index   INTEGER NOT NULL,     -- Ordning i transkriptet
  content       TEXT NOT NULL,        -- Själva texten (~500-800 tokens)
  timestamp     TEXT,                 -- "14:32" - för källhänvisning
  embedding     VECTOR(1536),         -- OpenAI embedding dimensions
  created_at    TIMESTAMP DEFAULT NOW()
);

-- Index för snabb vector-sökning
CREATE INDEX ON transcript_chunks
  USING ivfflat (embedding vector_cosine_ops);
```

### Chunking-strategi
- **Storlek:** ~500-800 tokens per chunk
- **Överlapp:** ~50 tokens mellan chunks för bättre kontext
- **Delning:** Vid naturliga pauser (nya stycken, lång tystnad)
- **Metadata:** Behåll timestamp-info för varje chunk

### Utökat flöde vid transkript-import
1. Spara markdown till Vercel Blob (som idag)
2. Dela upp transkriptet i chunks (~500-800 tokens var)
3. Generera embedding för varje chunk via OpenAI
4. Spara chunks + embeddings i Postgres

---

## API-design

### POST /api/chat

**Request:**
```typescript
{
  message: string;                      // Användarens fråga
  conversationHistory: Message[];       // Tidigare meddelanden
  selectedVideos: string[] | "all";     // Video-IDs eller "all"
  mode: "strict" | "hybrid";            // Toggle-värdet
}
```

**Response (streaming):**
```typescript
{
  content: string;                      // AI-svaret
  sources: {
    videoId: string;
    title: string;
    timestamp: string;
  }[];
}
```

### Vector search - dynamisk relevanströskel

```typescript
// Istället för fast antal chunks:
// - Ta chunks med relevans-score ≥ 0.7
// - Max 5 chunks per video (så en video inte dominerar)
// - Visa för användaren: "Sökte i 3 av 23 videor"
```

---

## Prompt-struktur

```
SYSTEM:
Du är en assistent som hjälper användaren analysera YouTube-videor.
{mode === "strict"
  ? "Svara ENDAST baserat på transkripten nedan. Om svaret inte finns, säg det."
  : "Använd transkripten som primär källa. Komplettera med allmän kunskap vid behov och markera tydligt vad som kommer varifrån."}

Ange alltid källor i formatet [Video: "titel" @ timestamp].

KONTEXT FRÅN TRANSKRIPT:
---
[Video: "React Basics" @ 12:45]
"Hooks introducerades i React 16.8 och förändrade hur vi..."
---
[Video: "React Basics" @ 18:20]
"UseState är den vanligaste hooken..."
---

USER:
{användarens fråga}
```

---

## UI-design

### Desktop-layout

```
┌─────────────────────────────────────────────────────────────────┐
│  YouTube Transcript Chat                    [📹 Strikt] ←→ [🌐]│
├─────────────────────────────────────────────────────────────────┤
│ ┌─ Transkript ──────────────────┐ ┌───────────────────────────┐ │
│ │ ☑ Alla (23)                   │ │                           │ │
│ │ ───────────────               │ │  👋 Hej! Ställ en fråga   │ │
│ │ ☐ React Basics                │ │     om dina videor.       │ │
│ │ ☐ TypeScript Deep Dive        │ │                           │ │
│ │ ☐ Next.js Tutorial            │ │ ─────────────────────────  │ │
│ │ ☐ Node.js Crash Course        │ │                           │ │
│ │ ...                           │ │  🧑 Vad säger de om hooks?│ │
│ │                               │ │                           │ │
│ │ [🔍 Sök videor...]            │ │  🤖 I "React Basics"      │ │
│ │                               │ │  förklarar han att hooks  │ │
│ └───────────────────────────────┘ │  introducerades i 16.8... │ │
│                                   │                           │ │
│                                   │  📹 Källor:               │ │
│                                   │  • React Basics @ 12:45   │ │
│                                   │  • React Basics @ 18:20   │ │
│                                   │                           │ │
│                                   ├───────────────────────────┤ │
│                                   │ [Skriv ett meddelande...] │ │
│                                   │                     [➤]   │ │
└───────────────────────────────────┴───────────────────────────┴─┘
```

### Responsiv design
- **Desktop:** Två kolumner som ovan
- **Mobil:** Video-väljare som expanderbar drawer/modal

### Komponenter
- Video-väljare med sök/filter
- Chattfönster med meddelanden
- Mode-toggle (strikt/hybrid) i header
- Klickbara källhänvisningar som öppnar transkriptet

---

## AI Provider-abstraktion

För att enkelt kunna lägga till Claude senare:

```
lib/
├── ai/
│   ├── types.ts          # Gemensamma interfaces
│   ├── provider.ts       # Factory-funktion
│   ├── openai.ts         # OpenAI-implementation
│   └── claude.ts         # (läggs till senare)
```

### Interface

```typescript
// types.ts
interface AIProvider {
  chat(params: {
    messages: Message[];
    context: TranscriptChunk[];
    mode: "strict" | "hybrid";
  }): AsyncIterable<StreamChunk>;

  embed(text: string): Promise<number[]>;
}

// provider.ts
export function getAIProvider(name: "openai" | "claude"): AIProvider {
  switch (name) {
    case "openai": return new OpenAIProvider();
    case "claude": return new ClaudeProvider();
  }
}
```

### Användning

```typescript
// api/chat/route.ts
const provider = getAIProvider(process.env.AI_PROVIDER || "openai");
const stream = provider.chat({ messages, context, mode });
```

### Lägga till Claude senare
1. Skapa `lib/ai/claude.ts` som implementerar `AIProvider`
2. Lägg till `ANTHROPIC_API_KEY` i miljövariabler
3. Ändra `AI_PROVIDER` env-variabel - klart!

---

## Felhantering

| Scenario | Hantering |
|----------|-----------|
| Inga träffar i vector search | "Jag hittade inget relevant i de valda transkripten. Prova att välja fler videor eller ställ frågan annorlunda." |
| Strikt mode, svar finns ej | "Det finns ingen information om detta i dina valda videor." (+ föreslå byta till hybrid) |
| Token-gräns nås | Dynamisk tröskel (≥0.7 relevans), max 5 chunks per video |
| API timeout (Vercel 10s) | Använd streaming - första token kommer snabbt |
| Embedding API nere | Kö:a nya transkript, visa befintliga utan nya embeddings |
| Tomt transkript | Skippa vid indexering, visa varning vid import |

### Rate limiting
- Begränsa antal frågor per minut per session
- Visa tydligt meddelande: "Vänta lite innan nästa fråga"

### Kostnadsoptimering
- Cache:a embeddings (de ändras aldrig för samma text)
- Embedding-batch: generera flera åt gången vid import
- Använd `text-embedding-3-small` (billigare, nästan lika bra som ada-002)

---

## Implementationsfaser

### Fas 1: Grundläggande infrastruktur
- Sätta upp Vercel Postgres med pgvector
- Skapa `transcript_chunks` tabell
- Bygga embedding-generering vid transkript-import
- Backfill: generera embeddings för befintliga transkript

### Fas 2: Sök-API
- Vector search endpoint
- Dynamisk relevans-tröskel (≥0.7)
- Max 5 chunks per video
- Returnera chunks med metadata (titel, timestamp)

### Fas 3: Chat API
- `/api/chat` med streaming
- OpenAI-integration med provider-abstraktion
- Prompt-byggare med kontext och källhänvisningar
- Strict/hybrid mode-hantering

### Fas 4: Chat UI
- Grundläggande chat-interface
- Video-väljare (alla / urval)
- Mode-toggle (strikt/hybrid)
- Klickbara källhänvisningar

### Fas 5: Polish
- Responsiv design (mobil)
- Rate limiting
- Felhantering och loading states
- Kostnadsoptimering (embedding-modell)

### Fas 6: (Framtida) Claude-stöd
- Implementera `ClaudeProvider`
- UI för att välja modell (valfritt)

---

## Nya miljövariabler

```bash
# Vercel Postgres (skapas automatiskt vid setup)
POSTGRES_URL=
POSTGRES_PRISMA_URL=
POSTGRES_URL_NON_POOLING=

# Befintlig (redan konfigurerad)
OPENAI_API_KEY=

# Framtida
ANTHROPIC_API_KEY=
AI_PROVIDER=openai  # eller "claude"
```

---

## Filstruktur (ny)

```
app/
├── chat/
│   └── page.tsx              # Chat-sida
├── api/
│   ├── chat/
│   │   └── route.ts          # Chat API med streaming
│   └── embeddings/
│       └── route.ts          # Generera embeddings (intern)
lib/
├── ai/
│   ├── types.ts              # AIProvider interface
│   ├── provider.ts           # Factory-funktion
│   └── openai.ts             # OpenAI implementation
├── embeddings.ts             # Chunking + embedding-logik
└── vector-search.ts          # Postgres vector search
components/
├── chat/
│   ├── ChatWindow.tsx        # Huvudkomponent
│   ├── MessageList.tsx       # Lista meddelanden
│   ├── MessageInput.tsx      # Input-fält
│   ├── VideoSelector.tsx     # Video-väljare
│   ├── ModeToggle.tsx        # Strikt/hybrid toggle
│   └── SourceList.tsx        # Källhänvisningar
```
