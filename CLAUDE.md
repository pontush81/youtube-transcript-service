# YouTube Transcript Service

## Snabbstart
```bash
npm install
npm run dev
```

## Projektöversikt
Next.js 16 app som hämtar YouTube-transkript via Supadata API och sparar som Markdown till Vercel Blob Storage.

## Live URL
https://youtube-transcript-service-two.vercel.app

## GitHub
https://github.com/pontush81/youtube-transcript-service

## Tech Stack
- Next.js 16 (App Router, Edge Runtime)
- TypeScript
- Tailwind CSS v4
- Supadata API (transkript)
- Vercel Blob Storage (fillagring)
- OpenAI GPT-4o-mini (AI-formatering av transkript)

## API Endpoints
- `POST /api/transcript` - Hämta transkript via formulär
- `GET /api/webhook?url={youtubeUrl}` - Zapier-kompatibel webhook

## Miljövariabler (Vercel)
- `SUPADATA_API_KEY` - API-nyckel från supadata.ai
- `BLOB_READ_WRITE_TOKEN` - Skapas automatiskt av Vercel Blob
- `OPENAI_API_KEY` - API-nyckel från platform.openai.com (valfri, för AI-formatering)

## Filstruktur
```
app/
├── page.tsx              # Formulär
├── success/page.tsx      # Resultat med nedladdning
├── transcripts/page.tsx  # Lista sparade transkript
├── transcripts/[id]/page.tsx  # Läs transkript
└── api/
    ├── transcript/route.ts
    ├── transcripts/route.ts  # Lista alla transkript
    └── webhook/route.ts
lib/
├── youtube.ts            # Supadata integration
├── markdown.ts           # Genererar MD
├── storage.ts            # Vercel Blob
└── format-ai.ts          # OpenAI formatering
components/
├── TranscriptForm.tsx
└── DownloadButton.tsx
```

## Begränsningar
- Supadata gratis: 100 videos/månad
- Uppgradera på https://supadata.ai för fler
