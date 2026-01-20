import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';

// Använd Node.js runtime för längre timeout (60 sek på Hobby, 300 sek på Pro)
export const maxDuration = 60;

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

    // Formatera med OpenAI
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
            content: `Du är en expert på att formatera transkript från YouTube-videor för bättre läsbarhet.

Dina uppgifter:
1. Dela upp texten i logiska stycken baserat på ämne eller tanke
2. Om det finns flera talare, identifiera talarbyten och markera med "**Talare 1:**", "**Talare 2:**" etc. Om du kan gissa vem som talar (t.ex. från sammanhanget), använd deras namn
3. Lägg till beskrivande mellanrubriker (## Rubrik) när ämnet ändras markant
4. Behåll all originaltext - ta inte bort något innehåll
5. Rätta uppenbara transkriptionsfel om du är säker
6. Returnera ENDAST den formaterade texten, ingen extra kommentar

Svara på samma språk som transkriptet.`,
          },
          {
            role: 'user',
            content: `Formatera detta transkript från videon "${title}":\n\n${transcript}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 16000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API error:', errorData);
      return NextResponse.json(
        { success: false, error: 'AI-formatering misslyckades' },
        { status: 500 }
      );
    }

    const data = await response.json();
    const formatted = data.choices?.[0]?.message?.content;

    if (!formatted || formatted.length < transcript.length * 0.5) {
      return NextResponse.json(
        { success: false, error: 'AI gav för kort svar' },
        { status: 500 }
      );
    }

    // Extrahera filnamn från URL för att behålla samma sökväg
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
      message: 'Transkriptet har formaterats med AI',
    });
  } catch (error) {
    console.error('Format error:', error);
    return NextResponse.json(
      { success: false, error: 'Ett oväntat fel uppstod' },
      { status: 500 }
    );
  }
}
