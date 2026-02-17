import { NextRequest, NextResponse } from 'next/server';
import { put, del } from '@vercel/blob';
import { auth } from '@clerk/nextjs/server';
import { isValidBlobUrl } from '@/lib/validations';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  // Require authentication
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: 'OpenAI API key is missing' },
      { status: 500 }
    );
  }

  try {
    const { blobUrl, title } = await request.json();

    if (!blobUrl) {
      return NextResponse.json(
        { success: false, error: 'Blob URL is required' },
        { status: 400 }
      );
    }

    // SSRF protection: validate blob URL
    if (!isValidBlobUrl(blobUrl)) {
      return NextResponse.json(
        { success: false, error: 'Invalid blob URL' },
        { status: 400 }
      );
    }

    // Hämta nuvarande innehåll
    const contentResponse = await fetch(blobUrl);
    if (!contentResponse.ok) {
      return NextResponse.json(
        { success: false, error: 'Could not fetch transcript' },
        { status: 404 }
      );
    }

    const content = await contentResponse.text();

    // Kolla om redan har sammanfattning
    if (content.includes('## Sammanfattning') || content.includes('## Summary')) {
      return NextResponse.json(
        { success: false, error: 'Transcript already has a summary' },
        { status: 400 }
      );
    }

    // Extrahera transkript-delen
    const parts = content.split('---');
    if (parts.length < 2) {
      return NextResponse.json(
        { success: false, error: 'Invalid transcript format' },
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
- Create 5–10 bullet points with the most important insights or takeaways
- Each bullet point should be 1–2 sentences maximum
- Focus on actionable insights, key concepts, decisions, explanations, and main arguments
- Prioritize factual information and reasoning over anecdotes or filler
- Ignore ads, sponsor messages, greetings, housekeeping, and repetitive content
- Avoid vague statements; each bullet should convey a concrete idea
- Use bullet points (-)
- Do NOT include any introduction or conclusion text
- Do NOT translate — always use the same language as the input`,
          },
          {
            role: 'user',
            content: `Create a summary of the key points from this transcript.

<video_title>${(title || '').substring(0, 200)}</video_title>

<transcript>
${transcript.substring(0, 12000)}
</transcript>`,
          },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      console.error('OpenAI API error:', response.status);
      return NextResponse.json(
        { success: false, error: 'AI summary generation failed' },
        { status: 500 }
      );
    }

    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content;

    if (!summary) {
      return NextResponse.json(
        { success: false, error: 'No summary was generated' },
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

    // Radera gamla bloben först
    await del(blobUrl);

    // Spara uppdaterad version
    const blob = await put(`transcripts/${filename}`, newContent, {
      access: 'public',
      contentType: 'text/markdown',
    });

    return NextResponse.json({
      success: true,
      newUrl: blob.url,
      message: 'Summary has been added',
    });
  } catch (error) {
    console.error('Summarize error:', error);
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
