import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';

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

    // Kolla om redan har sammanfattning
    if (content.includes('## Sammanfattning') || content.includes('## Summary')) {
      return NextResponse.json(
        { success: false, error: 'Transkriptet har redan en sammanfattning' },
        { status: 400 }
      );
    }

    // Extrahera transkript-delen
    const parts = content.split('---');
    if (parts.length < 2) {
      return NextResponse.json(
        { success: false, error: 'Ogiltigt transkript-format' },
        { status: 400 }
      );
    }

    const header = parts[0];
    const transcript = parts.slice(1).join('---').trim();

    // Generera sammanfattning med OpenAI
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
            content: `You create concise summaries of video transcripts.

RULES:
- Write in the SAME LANGUAGE as the transcript (if English, write in English; if Swedish, write in Swedish)
- Create 5-10 bullet points with the most important insights/takeaways
- Each point should be 1-2 sentences max
- Focus on actionable insights, key concepts, and main arguments
- Use bullet points (-)
- Do NOT include any introduction or conclusion text, just the bullet points
- Do NOT translate - use the same language as the input`,
          },
          {
            role: 'user',
            content: `Create a summary of the key points from this transcript of "${title}":\n\n${transcript.substring(0, 12000)}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      console.error('OpenAI API error:', response.status);
      return NextResponse.json(
        { success: false, error: 'AI-sammanfattning misslyckades' },
        { status: 500 }
      );
    }

    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content;

    if (!summary) {
      return NextResponse.json(
        { success: false, error: 'Ingen sammanfattning genererades' },
        { status: 500 }
      );
    }

    // Bygg nytt innehåll med sammanfattning
    const summarySection = `## Sammanfattning\n\n${summary}\n\n---\n\n`;
    const newContent = header + '---\n\n' + summarySection + transcript + '\n';

    // Extrahera filnamn från URL
    const urlParts = new URL(blobUrl);
    const pathname = urlParts.pathname;
    const filename = pathname.split('/').pop() || 'transcript.md';

    // Spara uppdaterad version
    const blob = await put(`transcripts/${filename}`, newContent, {
      access: 'public',
      contentType: 'text/markdown',
    });

    return NextResponse.json({
      success: true,
      newUrl: blob.url,
      message: 'Sammanfattning har lagts till',
    });
  } catch (error) {
    console.error('Summarize error:', error);
    return NextResponse.json(
      { success: false, error: 'Ett oväntat fel uppstod' },
      { status: 500 }
    );
  }
}
