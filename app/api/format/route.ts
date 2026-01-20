import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';

// Använd Node.js runtime för längre timeout
export const maxDuration = 60;

const CHUNK_SIZE = 4000; // ~4000 tecken per chunk för snabbare svar

async function formatChunk(
  apiKey: string,
  chunk: string,
  chunkIndex: number,
  isFirst: boolean
): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Du formaterar en DEL av ett YouTube-transkript för bättre läsbarhet.

Uppgifter:
1. Dela upp i logiska stycken
2. Markera talarbyten med "**Talare:**" om du ser dem (t.ex. >> eller namnbyten)
${isFirst ? '3. Lägg till en kort sammanfattande rubrik (## Rubrik) i början om lämpligt' : '3. Lägg INTE till rubrik i början - detta är en fortsättning'}
4. Behåll ALL text - ta inte bort något
5. Returnera ENDAST formaterad text, ingen kommentar

Svara på samma språk som texten.`,
        },
        {
          role: 'user',
          content: chunk,
        },
      ],
      temperature: 0.2,
      max_tokens: 6000,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI error for chunk ${chunkIndex}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || chunk;
}

function splitIntoChunks(text: string, chunkSize: number): string[] {
  const chunks: string[] = [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  let currentChunk = '';

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: 'OpenAI API-nyckel saknas' },
      { status: 500 }
    );
  }

  try {
    const { blobUrl, title } = await request.json();

    if (!blobUrl) {
      return NextResponse.json(
        { success: false, error: 'Blob URL krävs' },
        { status: 400 }
      );
    }

    // Hämta nuvarande innehåll
    const contentResponse = await fetch(blobUrl);
    if (!contentResponse.ok) {
      return NextResponse.json(
        { success: false, error: 'Kunde inte hämta transkript' },
        { status: 404 }
      );
    }

    const content = await contentResponse.text();

    // Extrahera transkript-delen (efter "---")
    const parts = content.split('---');
    if (parts.length < 2) {
      return NextResponse.json(
        { success: false, error: 'Ogiltigt transkript-format' },
        { status: 400 }
      );
    }

    const header = parts[0] + '---\n\n';
    const transcript = parts.slice(1).join('---').trim();

    // Dela upp i chunks och formatera parallellt
    const chunks = splitIntoChunks(transcript, CHUNK_SIZE);
    console.log(`Formatting ${chunks.length} chunks for "${title}"`);

    // Formatera alla chunks parallellt för snabbhet
    const formattedChunks = await Promise.all(
      chunks.map((chunk, i) => formatChunk(apiKey, chunk, i, i === 0))
    );

    const formatted = formattedChunks.join('\n\n');

    // Extrahera filnamn från URL
    const urlParts = new URL(blobUrl);
    const pathname = urlParts.pathname;
    const filename = pathname.split('/').pop() || 'transcript.md';

    // Spara formaterad version
    const newContent = header + formatted + '\n';
    const blob = await put(`transcripts/${filename}`, newContent, {
      access: 'public',
      contentType: 'text/markdown',
    });

    return NextResponse.json({
      success: true,
      newUrl: blob.url,
      message: `Transkriptet har formaterats (${chunks.length} delar)`,
    });
  } catch (error) {
    console.error('Format error:', error);
    return NextResponse.json(
      { success: false, error: 'Ett oväntat fel uppstod vid formatering' },
      { status: 500 }
    );
  }
}
