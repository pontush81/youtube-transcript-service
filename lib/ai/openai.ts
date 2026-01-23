import OpenAI from 'openai';
import { AIProvider, ChatParams, TranscriptChunk } from './types';
import { embeddingCache } from './embedding-cache';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function buildSystemPrompt(mode: 'strict' | 'hybrid'): string {
  const modeInstruction = mode === 'strict'
    ? `Svara baserat på transkripten nedan. Du kan:
- Sammanfatta innehåll från en eller flera videor
- Jämföra och analysera innehåll mellan videor (hitta likheter, skillnader, teman)
- Svara på frågor om vad videorna handlar om

Om transkripten inte innehåller relevant innehåll för att svara på frågan, säg det tydligt.`
    : `Använd transkripten som primär källa. Du kan:
- Sammanfatta innehåll från en eller flera videor
- Jämföra och analysera innehåll mellan videor
- Komplettera med allmän kunskap vid behov (markera tydligt vad som kommer från videorna vs allmän kunskap)`;

  return `Du är en hjälpsam assistent som analyserar YouTube-transkript.

${modeInstruction}

När du refererar till specifik information från ett transkript, ange källan i formatet [Video: "titel"].

Svara på svenska om användaren skriver på svenska.`;
}

function buildContextPrompt(chunks: TranscriptChunk[]): string {
  if (chunks.length === 0) {
    return '\n\nINGA TRANSKRIPT VALDA.';
  }

  let context = '\n\nKONTEXT FRÅN TRANSKRIPT:\n';

  for (const chunk of chunks) {
    const timestamp = chunk.timestampStart ? ` @ ${chunk.timestampStart}` : '';
    context += `---\n[Video: "${chunk.videoTitle}"${timestamp}]\n${chunk.content}\n`;
  }

  return context;
}

export class OpenAIProvider implements AIProvider {
  async *chat(params: ChatParams): AsyncIterable<string> {
    const { messages, context, mode } = params;

    const systemPrompt = buildSystemPrompt(mode) + buildContextPrompt(context);

    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  }

  async embed(text: string): Promise<number[]> {
    // Check cache first
    const cached = embeddingCache.get(text);
    if (cached) {
      return cached;
    }

    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    const embedding = response.data[0].embedding;

    // Cache the result
    embeddingCache.set(text, embedding);
    return embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    // Check which texts are cached
    const { cached, uncached } = embeddingCache.getMany(texts);

    // If all cached, return directly
    if (uncached.length === 0) {
      return texts.map((_, i) => cached.get(i)!);
    }

    // Fetch uncached embeddings
    const uncachedTexts = uncached.map(i => texts[i]);
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: uncachedTexts,
    });

    // Cache new embeddings
    const newEmbeddings = response.data.map(d => d.embedding);
    uncached.forEach((originalIndex, newIndex) => {
      embeddingCache.set(texts[originalIndex], newEmbeddings[newIndex]);
      cached.set(originalIndex, newEmbeddings[newIndex]);
    });

    // Return all embeddings in original order
    return texts.map((_, i) => cached.get(i)!);
  }
}
