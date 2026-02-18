import OpenAI from 'openai';
import { Message } from './types';
import { logger } from '@/lib/logger';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Rewrites a follow-up query to be self-contained by incorporating
 * relevant context from conversation history.
 *
 * Example:
 * - History: "What does the Claude video say about prompting?" -> [answer]
 * - Query: "What about the HubSpot video?"
 * - Rewritten: "What does the HubSpot video say about prompting?"
 */
export async function rewriteQueryWithContext(
  query: string,
  conversationHistory: Message[]
): Promise<string> {
  // If no history or query is already self-contained, return as-is
  if (conversationHistory.length === 0) {
    return query;
  }

  // Only use last 4 messages for context (2 exchanges)
  const recentHistory = conversationHistory.slice(-4);

  // Check if query seems to need context (contains references like "that", "it", "this", etc.)
  const needsContext = /\b(det|detta|den|dessa|that|this|it|them|those|more|också|samma|videon?|den där)\b/i.test(query) ||
    query.length < 30; // Short queries often need context

  if (!needsContext) {
    return query;
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You rewrite follow-up questions to be self-contained by incorporating context from the conversation.

Rules:
- If the query is already self-contained, return it unchanged
- Include relevant context (topics, video names, etc.) from the conversation
- Keep it concise - just the rewritten question
- Preserve the user's language (Swedish or English)
- Return ONLY the rewritten query, nothing else`
        },
        {
          role: 'user',
          content: `<conversation>
${recentHistory.map(m => `${m.role}: ${m.content.substring(0, 200)}`).join('\n')}
</conversation>

<query>${query.substring(0, 500)}</query>

Rewritten query:`
        }
      ],
      max_tokens: 150,
      temperature: 0,
    });

    const rewritten = response.choices[0]?.message?.content?.trim();

    // Sanity check: if rewritten is empty or much longer, use original
    if (!rewritten || rewritten.length > query.length * 3) {
      return query;
    }

    return rewritten;
  } catch (error) {
    logger.error('Query rewrite failed', { error: error instanceof Error ? error.message : String(error) });
    return query; // Fallback to original
  }
}
