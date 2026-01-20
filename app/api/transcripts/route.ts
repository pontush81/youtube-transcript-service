import { list } from '@vercel/blob';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

export interface TranscriptItem {
  videoId: string;
  url: string;
  uploadedAt: Date;
  size: number;
}

export async function GET() {
  try {
    const { blobs } = await list({ prefix: 'transcripts/' });

    const transcripts: TranscriptItem[] = blobs.map((blob) => {
      // Filnamn är: transcripts/{videoId}-{timestamp}.md
      const filename = blob.pathname.replace('transcripts/', '').replace('.md', '');
      const parts = filename.split('-');
      const videoId = parts.slice(0, -1).join('-'); // Allt utom timestamp

      return {
        videoId,
        url: blob.url,
        uploadedAt: blob.uploadedAt,
        size: blob.size,
      };
    });

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
