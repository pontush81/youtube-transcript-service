import { list } from '@vercel/blob';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

export interface TranscriptItem {
  videoId: string;
  title: string;
  url: string;
  uploadedAt: Date;
  size: number;
}

// Extrahera titel från Markdown-innehåll (första raden är alltid "# {title}")
function extractTitleFromMarkdown(content: string): string | null {
  const firstLine = content.split('\n')[0];
  if (firstLine?.startsWith('# ')) {
    return firstLine.substring(2).trim();
  }
  return null;
}

export async function GET() {
  try {
    const { blobs } = await list({ prefix: 'transcripts/' });

    // Hämta titel från varje fil
    const transcripts: TranscriptItem[] = await Promise.all(
      blobs.map(async (blob) => {
        // Filnamn är: transcripts/{videoId}-{timestamp}.md
        const filename = blob.pathname.replace('transcripts/', '').replace('.md', '');
        const parts = filename.split('-');
        const videoId = parts.slice(0, -1).join('-');

        // Hämta titeln från filinnehållet
        let title = videoId; // Fallback till videoId
        try {
          const response = await fetch(blob.url);
          if (response.ok) {
            // Läs bara första 500 bytes för att få titeln
            const text = await response.text();
            const extractedTitle = extractTitleFromMarkdown(text);
            if (extractedTitle) {
              title = extractedTitle;
            }
          }
        } catch {
          // Om fil inte kan hämtas, använd videoId
        }

        return {
          videoId,
          title,
          url: blob.url,
          uploadedAt: blob.uploadedAt,
          size: blob.size,
        };
      })
    );

    // Sortera med senaste först
    transcripts.sort((a, b) =>
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    );

    return NextResponse.json({ transcripts });
  } catch (error) {
    console.error('Error listing transcripts:', error);
    return NextResponse.json(
      { error: 'Kunde inte hämta transkript-lista' },
      { status: 500 }
    );
  }
}
