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
  const systemPrompt = `Du är en textformaterare. Din ENDA uppgift är att göra transkripttext mer läsbar genom att lägga till styckeindelning.

REGLER:
- SAMMA SPRÅK som originaltexten. Ingen översättning.
- Dela upp i stycken där det finns naturliga pauser (ämnesbyte, ny tanke, retorisk paus)
- Ett stycke = 2-5 meningar vanligtvis
- Vid tydliga talarbyten (t.ex. >> eller när någon svarar): lägg en tomrad
- BEHÅLL all originaltext exakt - ändra inga ord
- Returnera ENDAST den formaterade texten
${isFirst ? '- Du FÅR lägga till EN rubrik (##) i början som sammanfattar ämnet' : '- Lägg INTE till någon rubrik - detta är en fortsättning'}

EXEMPEL på input:
"Så det viktigaste är att förstå grunderna. >> Ja precis och sen kan man bygga vidare på det. Man måste verkligen ta sig tid."

EXEMPEL på output:
Så det viktigaste är att förstå grunderna.

Ja precis och sen kan man bygga vidare på det. Man måste verkligen ta sig tid.`;

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
          content: systemPrompt,
        },
        {
          role: 'user',
          content: chunk,
        },
      ],
      temperature: 0.1,
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
