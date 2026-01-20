export async function formatTranscriptWithAI(
  transcript: string,
  title: string
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;

  // Om inget API-nyckel, returnera oformaterad text
  if (!apiKey) {
    console.log('No OPENAI_API_KEY, skipping AI formatting');
    return transcript;
  }

  try {
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
      console.error('OpenAI API error:', response.status);
      return transcript;
    }

    const data = await response.json();
    const formatted = data.choices?.[0]?.message?.content;

    if (formatted && formatted.length > transcript.length * 0.5) {
      console.log(`AI formatting successful: ${transcript.length} -> ${formatted.length} chars`);
      return formatted;
    }

    // Om svaret är för kort, något gick fel
    console.log('AI response too short, using original');
    return transcript;
  } catch (error) {
    console.error('AI formatting error:', error);
    return transcript; // Fallback till original
  }
}
