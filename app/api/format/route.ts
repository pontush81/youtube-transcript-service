import { NextRequest, NextResponse } from 'next/server';
import { put, del } from '@vercel/blob';

// Vercel free tier har 10s timeout
export const maxDuration = 10;

// Enkel formatering utan AI - lägger till styckebrytningar
function simpleFormat(text: string): string {
  // Dela upp i meningar
  const sentences = text.split(/(?<=[.!?])\s+/);

  const paragraphs: string[] = [];
  let currentParagraph: string[] = [];

  for (const sentence of sentences) {
    currentParagraph.push(sentence);

    // Skapa nytt stycke var 3-5:e mening eller vid tydliga pauser
    if (
      currentParagraph.length >= 4 ||
      sentence.endsWith('?') ||
      sentence.includes('>>') ||
      /^(So|Now|But|However|Then|Next|First|Finally|Also|And then)/i.test(sentence)
    ) {
      paragraphs.push(currentParagraph.join(' '));
      currentParagraph = [];
    }
  }

  // Lägg till resterande meningar
  if (currentParagraph.length > 0) {
    paragraphs.push(currentParagraph.join(' '));
  }

  return paragraphs.join('\n\n');
}

export async function POST(request: NextRequest) {
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
    let restContent = parts.slice(1).join('---').trim();

    // Separera sammanfattning från transkript om den finns
    let summarySection = '';
    let transcript = restContent;

    if (restContent.includes('## Sammanfattning') || restContent.includes('## Summary')) {
      const summaryMatch = restContent.match(/(## (?:Sammanfattning|Summary)[\s\S]*?)(?=\n---\n|## Transkript|## Transcript|$)/i);
      if (summaryMatch) {
        summarySection = summaryMatch[1].trim() + '\n\n---\n\n';
        transcript = restContent.replace(summaryMatch[1], '').replace(/^[\s]*---[\s]*/, '').trim();
      }
    }

    if (!transcript || transcript.length < 10) {
      return NextResponse.json(
        { success: false, error: 'Kunde inte hitta transkripttext att formatera' },
        { status: 400 }
      );
    }

    console.log(`Simple formatting for "${title}", transcript length: ${transcript.length}`);

    // Enkel formatering utan AI
    const formatted = simpleFormat(transcript);

    // Extrahera filnamn från URL
    const urlParts = new URL(blobUrl);
    const pathname = urlParts.pathname;
    const filename = pathname.split('/').pop() || 'transcript.md';

    // Radera gamla bloben först
    await del(blobUrl);

    // Spara formaterad version
    const newContent = header + summarySection + formatted + '\n';
    const blob = await put(`transcripts/${filename}`, newContent, {
      access: 'public',
      contentType: 'text/markdown',
    });

    return NextResponse.json({
      success: true,
      newUrl: blob.url,
      message: 'Transkriptet har formaterats',
    });
  } catch (error) {
    console.error('Format error:', error);
    return NextResponse.json(
      { success: false, error: 'Ett oväntat fel uppstod vid formatering' },
      { status: 500 }
    );
  }
}
