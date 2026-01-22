import OpenAI from 'openai';
import { AIProvider, ChatParams, TranscriptChunk } from './types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function buildSystemPrompt(mode: 'strict' | 'hybrid'): string {
  const modeInstruction = mode === 'strict'
    ? 'Svara ENDAST baserat på transkripten nedan. Om svaret inte finns i transkripten, säg tydligt "Jag hittade ingen information om detta i de valda videorna."'
    : 'Använd transkripten som primär källa. Du kan komplettera med allmän kunskap vid behov, men markera tydligt vad som kommer från videorna vs allmän kunskap.';

  return `Du är en hjälpsam assistent som analyserar YouTube-transkript.

${modeInstruction}

När du refererar till information från transkript, ange alltid källan i formatet [Video: "titel" @ timestamp] eller [Video: "titel"] om timestamp saknas.

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
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    return response.data[0].embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: texts,
    });
    return response.data.map(d => d.embedding);
  }
}
