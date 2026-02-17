# YouTube Transcript Service

> **Påminnelse:** Kolla `docs/TODO.md` för pågående arbete och nästa steg.

## Snabbstart
```bash
npm install
npm run dev
```

## Projektöversikt
Next.js 16 app som hämtar YouTube-transkript och sparar som Markdown till Vercel Blob Storage.

## Live URL
https://youtube-transcript-service-two.vercel.app

## GitHub
https://github.com/pontush81/youtube-transcript-service

## Tech Stack
- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS v4
- youtube-transcript (transkript, gratis, ingen API-nyckel)
- YouTube Data API v3 (metadata, valfri)
- Vercel Blob Storage (fillagring)
- OpenAI GPT-4o-mini (AI-formatering)
- Clerk (autentisering)
- PostgreSQL (metadata, embeddings, rate limiting)

## API Endpoints
- `POST /api/transcript` - Hämta transkript via formulär
- `GET /api/webhook?url={youtubeUrl}` - Zapier-kompatibel webhook
- `GET /api/transcripts` - Lista alla transkript med metadata

## Miljövariabler

### Obligatoriska
- `BLOB_READ_WRITE_TOKEN` - Skapas automatiskt av Vercel Blob
- `DATABASE_URL` - PostgreSQL connection string
- `CLERK_SECRET_KEY` - Clerk API key
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk public key

### Valfria
- `YOUTUBE_API_KEY` - Google Cloud API key för rik metadata och spellistor
- `OPENAI_API_KEY` - För AI-formatering av transkript
- `ADMIN_KEY` - För admin API-åtkomst utan Clerk
- `RESEND_API_KEY` - För email-notifieringar vid nya användare

## Funktionalitet utan API-nycklar
Kärn-funktionalitet fungerar helt utan externa API-nycklar:
- ✅ Hämta transkript (youtube-transcript)
- ✅ Grundläggande metadata (titel, thumbnail, kanal via oEmbed)
- ✅ Spara och sök transkript
- ✅ Chat med transkript

## Utökad funktionalitet med YOUTUBE_API_KEY
Med en Google Cloud API-nyckel får du:
- ✅ Rik metadata (duration, visningar, likes, publicerat datum)
- ✅ Video-kategorier
- ✅ Spelliste-stöd
- ✅ Tags och beskrivningar

### Skapa YouTube API Key
1. Gå till https://console.cloud.google.com
2. Skapa ett projekt
3. Aktivera "YouTube Data API v3"
4. Skapa en API-nyckel under "Credentials"
5. Lägg till som `YOUTUBE_API_KEY` i Vercel

## Filstruktur
```
app/
├── page.tsx              # Formulär
├── success/page.tsx      # Resultat med nedladdning
├── transcripts/page.tsx  # Lista sparade transkript
├── transcripts/[id]/     # Läs transkript
├── chat/page.tsx         # Chat med transkript
└── api/
    ├── transcript/       # Hämta transkript
    ├── transcripts/      # Lista transkript
    ├── chat/             # AI-chat
    └── webhook/          # Zapier integration
lib/
├── youtube.ts            # YouTube utilities
├── transcript-service.ts # Transkript-hämtning
├── metadata-service.ts   # Metadata-hämtning
├── markdown.ts           # Genererar MD
├── storage.ts            # Vercel Blob
├── embeddings.ts         # Vector embeddings
└── format-ai.ts          # OpenAI formatering
```

## Admin Management

### Setting Up First Admin
```bash
npm run set-admin your-email@example.com
```

### Admin API Endpoints
Kräver `x-admin-key` header ELLER Clerk admin-roll.

- `GET /api/admin/users` - Lista alla användare
- `PATCH /api/admin/users` - Uppdatera användarroll

### Admin-Protected Routes
- `/api/db/setup` - Databas-initialisering
- `/api/db/migrate-*` - Databasmigrationer
- `/api/embeddings/backfill` - Bygg om embeddings
- `/api/metadata/backfill` - Hämta saknad metadata

### User Roles
- `admin` - Full åtkomst
- `user` (default) - Kan bara hantera egna transkript
