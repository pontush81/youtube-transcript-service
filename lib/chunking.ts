export interface Chunk {
  content: string;
  chunkIndex: number;
  timestampStart: string | null;
}

const TARGET_CHUNK_SIZE = 500; // tokens (roughly 2000 chars)
const MAX_CHUNK_SIZE = 800; // tokens (roughly 3200 chars)
const MIN_CHUNK_SIZE = 100; // tokens - don't create tiny chunks

// Rough token estimate: 1 token ≈ 4 characters for English
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Extract timestamp from text (formats: [00:12:34], (12:34), 12:34)
function extractTimestamp(text: string): string | null {
  const match = text.match(/[\[\(]?(\d{1,2}:)?(\d{1,2}:\d{2})[\]\)]?/);
  if (match) {
    const time = match[0].replace(/[\[\]\(\)]/g, '');
    return time;
  }
  return null;
}

// Split text into sentences (handles common abbreviations)
function splitIntoSentences(text: string): string[] {
  // Split on sentence-ending punctuation followed by space and capital letter
  // But preserve common abbreviations like Mr., Dr., etc.
  const sentences = text
    .replace(/([.!?])\s+(?=[A-Z])/g, '$1|||SPLIT|||')
    .split('|||SPLIT|||')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  return sentences;
}

// Extract actual transcript content (after metadata and summary)
function extractTranscriptContent(markdown: string): string {
  // Try to find content after the last "---" separator
  const parts = markdown.split(/\n---\n/);

  if (parts.length > 1) {
    // Get everything after the last separator
    const lastPart = parts[parts.length - 1].trim();

    // Check if this looks like actual transcript (not just summary bullets)
    if (lastPart.length > 500 && !lastPart.startsWith('- ')) {
      return lastPart;
    }

    // Try second to last part if last part is empty or short
    if (parts.length > 2) {
      const secondLastPart = parts[parts.length - 2].trim();
      if (secondLastPart.length > 500 && !secondLastPart.startsWith('- ')) {
        return secondLastPart;
      }
    }
  }

  // Fallback: remove header lines and return rest
  const lines = markdown.split('\n');
  const contentLines: string[] = [];
  let pastHeader = false;

  for (const line of lines) {
    // Skip header lines (title, metadata, summary headers)
    if (line.startsWith('#') || line.startsWith('>') || line === '---') {
      pastHeader = true;
      continue;
    }
    // Skip summary bullet points
    if (line.trim().startsWith('- ') && !pastHeader) {
      continue;
    }
    if (line.trim()) {
      contentLines.push(line);
    }
  }

  return contentLines.join('\n');
}

export function chunkTranscript(markdown: string): Chunk[] {
  const chunks: Chunk[] = [];

  // Extract the actual transcript content
  const content = extractTranscriptContent(markdown);

  if (!content || estimateTokens(content) < MIN_CHUNK_SIZE) {
    // Content too short, return as single chunk if there's anything
    if (content && content.trim()) {
      return [{
        content: content.trim(),
        chunkIndex: 0,
        timestampStart: extractTimestamp(content),
      }];
    }
    return [];
  }

  // First try: split by double newlines (paragraphs)
  let segments = content.split(/\n\n+/).filter(p => p.trim());

  // If we only got 1-2 segments but content is large, try single newlines
  if (segments.length <= 2 && estimateTokens(content) > TARGET_CHUNK_SIZE * 2) {
    segments = content.split(/\n/).filter(p => p.trim());
  }

  // If still too few segments, split by sentences
  if (segments.length <= 2 && estimateTokens(content) > TARGET_CHUNK_SIZE * 2) {
    segments = splitIntoSentences(content);
  }

  let currentChunk = '';
  let currentTimestamp: string | null = null;
  let chunkIndex = 0;

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];

    // Try to extract timestamp from this segment
    const segmentTimestamp = extractTimestamp(segment);
    if (segmentTimestamp && !currentTimestamp) {
      currentTimestamp = segmentTimestamp;
    }

    const segmentTokens = estimateTokens(segment);
    const currentTokens = estimateTokens(currentChunk);

    // If adding this segment would exceed max size, save current chunk first
    if (currentTokens + segmentTokens > MAX_CHUNK_SIZE && currentChunk) {
      chunks.push({
        content: currentChunk.trim(),
        chunkIndex,
        timestampStart: currentTimestamp,
      });
      chunkIndex++;

      // Start new chunk (no overlap for cleaner chunks)
      currentChunk = segment;
      currentTimestamp = segmentTimestamp;
    }
    // If current chunk reached target size, save it
    else if (currentTokens >= TARGET_CHUNK_SIZE && currentChunk) {
      chunks.push({
        content: currentChunk.trim(),
        chunkIndex,
        timestampStart: currentTimestamp,
      });
      chunkIndex++;

      currentChunk = segment;
      currentTimestamp = segmentTimestamp;
    }
    // Otherwise, add to current chunk
    else {
      currentChunk += (currentChunk ? '\n\n' : '') + segment;
    }
  }

  // Don't forget the last chunk
  if (currentChunk.trim() && estimateTokens(currentChunk) >= MIN_CHUNK_SIZE) {
    chunks.push({
      content: currentChunk.trim(),
      chunkIndex,
      timestampStart: currentTimestamp,
    });
  } else if (currentChunk.trim() && chunks.length > 0) {
    // Append small remaining content to last chunk
    chunks[chunks.length - 1].content += '\n\n' + currentChunk.trim();
  } else if (currentChunk.trim()) {
    // Only content, even if small
    chunks.push({
      content: currentChunk.trim(),
      chunkIndex,
      timestampStart: currentTimestamp,
    });
  }

  return chunks;
}

// Validate that transcript has enough content to be useful
export function validateTranscriptContent(markdown: string): {
  valid: boolean;
  reason?: string;
  contentLength: number;
  estimatedChunks: number;
} {
  const content = extractTranscriptContent(markdown);
  const tokens = estimateTokens(content);
  const estimatedChunks = Math.ceil(tokens / TARGET_CHUNK_SIZE);

  if (!content || content.length < 200) {
    return {
      valid: false,
      reason: 'Transcript content too short (less than 200 characters)',
      contentLength: content?.length || 0,
      estimatedChunks: 0,
    };
  }

  if (tokens < MIN_CHUNK_SIZE) {
    return {
      valid: false,
      reason: `Transcript too short (${tokens} tokens, minimum ${MIN_CHUNK_SIZE})`,
      contentLength: content.length,
      estimatedChunks: 0,
    };
  }

  return {
    valid: true,
    contentLength: content.length,
    estimatedChunks,
  };
}
