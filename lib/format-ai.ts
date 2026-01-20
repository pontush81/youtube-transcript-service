import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function formatTranscriptWithAI(
  transcript: string,
  title: string
): Promise<string> {
  // Om inget API-nyckel, returnera oformaterad text
  if (!process.env.OPENAI_API_KEY) {
    console.log('No OPENAI_API_KEY, skipping AI formatting');
    return transcript;
  }

  try {
    const response = await openai.chat.completions.create({
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
    });

    const formatted = response.choices[0]?.message?.content;

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
