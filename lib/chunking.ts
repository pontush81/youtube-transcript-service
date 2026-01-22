export interface Chunk {
  content: string;
  chunkIndex: number;
  timestampStart: string | null;
}

const TARGET_CHUNK_SIZE = 600; // tokens (roughly 2400 chars)
const OVERLAP_SIZE = 50; // tokens overlap between chunks

// Rough token estimate: 1 token ≈ 4 characters for English
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function chunkTranscript(markdown: string): Chunk[] {
  const chunks: Chunk[] = [];

  // Remove metadata header (everything before first ---)
  const parts = markdown.split('---');
  const transcriptContent = parts.length > 1 ? parts.slice(1).join('---').trim() : markdown;

  // Split by paragraphs (double newlines)
  const paragraphs = transcriptContent.split(/\n\n+/).filter(p => p.trim());

  let currentChunk = '';
  let currentTimestamp: string | null = null;
  let chunkIndex = 0;

  for (const paragraph of paragraphs) {
    // Check for timestamp pattern like [00:12:34] or (12:34)
    const timestampMatch = paragraph.match(/[\[\(]?(\d{1,2}:)?\d{1,2}:\d{2}[\]\)]?/);
    if (timestampMatch && !currentTimestamp) {
      currentTimestamp = timestampMatch[0].replace(/[\[\]\(\)]/g, '');
    }

    const paragraphTokens = estimateTokens(paragraph);
    const currentTokens = estimateTokens(currentChunk);

    if (currentTokens + paragraphTokens > TARGET_CHUNK_SIZE && currentChunk) {
      // Save current chunk
      chunks.push({
        content: currentChunk.trim(),
        chunkIndex,
        timestampStart: currentTimestamp,
      });
      chunkIndex++;

      // Start new chunk with overlap
      const words = currentChunk.split(' ');
      const overlapWords = words.slice(-Math.ceil(OVERLAP_SIZE * 4 / 5)); // ~50 tokens of overlap
      currentChunk = overlapWords.join(' ') + '\n\n' + paragraph;
      currentTimestamp = timestampMatch ? timestampMatch[0].replace(/[\[\]\(\)]/g, '') : null;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    }
  }

  // Don't forget the last chunk
  if (currentChunk.trim()) {
    chunks.push({
      content: currentChunk.trim(),
      chunkIndex,
      timestampStart: currentTimestamp,
    });
  }

  return chunks;
}
