import { describe, it, expect } from 'vitest';
import { chunkTranscript, validateTranscriptContent } from '../chunking';

describe('chunkTranscript', () => {
  it('returns empty array for empty content', () => {
    expect(chunkTranscript('')).toEqual([]);
  });

  it('returns single chunk for short transcript', () => {
    const markdown = `# Test Video\n\n---\n\n${'Hello world. '.repeat(50)}`;
    const chunks = chunkTranscript(markdown);
    expect(chunks.length).toBe(1);
    expect(chunks[0].chunkIndex).toBe(0);
  });

  it('creates multiple chunks for long transcript', () => {
    // Create content longer than TARGET_CHUNK_SIZE (500 tokens ~= 2000 chars)
    const longContent = 'This is a meaningful sentence about the topic. '.repeat(200);
    const markdown = `# Test Video\n\n---\n\n${longContent}`;
    const chunks = chunkTranscript(markdown);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('preserves chunk index ordering', () => {
    const longContent = 'This is a meaningful sentence about the topic. '.repeat(200);
    const markdown = `# Test Video\n\n---\n\n${longContent}`;
    const chunks = chunkTranscript(markdown);
    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i].chunkIndex).toBe(i);
    }
  });

  it('extracts timestamps from content', () => {
    const markdown = `# Test\n\n---\n\n[00:01:23] First part of the transcript with lots of content about various topics.\n\n[00:05:00] Second part with even more content about different subjects and themes.`;
    const chunks = chunkTranscript(markdown);
    expect(chunks[0].timestampStart).toBe('00:01:23');
  });
});

describe('validateTranscriptContent', () => {
  it('rejects empty content', () => {
    const result = validateTranscriptContent('');
    expect(result.valid).toBe(false);
  });

  it('rejects very short content', () => {
    const result = validateTranscriptContent('# Title\n\n---\n\nShort.');
    expect(result.valid).toBe(false);
  });

  it('accepts valid transcript', () => {
    const content = 'A '.repeat(200);
    const markdown = `# Title\n\n---\n\n${content}`;
    const result = validateTranscriptContent(markdown);
    expect(result.valid).toBe(true);
    expect(result.contentLength).toBeGreaterThan(200);
  });
});
