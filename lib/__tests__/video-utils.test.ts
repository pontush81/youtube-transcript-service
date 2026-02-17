import { describe, it, expect } from 'vitest';
import { extractYouTubeVideoId, extractVideoIdFromBlobPath } from '../video-utils';

describe('extractYouTubeVideoId', () => {
  it('returns 11-char ID as-is', () => {
    expect(extractYouTubeVideoId('421T2iWTQio')).toBe('421T2iWTQio');
  });

  it('strips timestamp suffix', () => {
    expect(extractYouTubeVideoId('421T2iWTQio-1768890127930')).toBe('421T2iWTQio');
  });

  it('strips timestamp and hash suffix', () => {
    expect(extractYouTubeVideoId('421T2iWTQio-1768890127930-iFrcB7dXcsgpJnULZGc7OeaGA0DbuC')).toBe('421T2iWTQio');
  });

  it('handles IDs with hyphens and underscores', () => {
    expect(extractYouTubeVideoId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractYouTubeVideoId('_-Ab12Cd_eF')).toBe('_-Ab12Cd_eF');
  });

  it('returns full input if no valid 11-char ID found', () => {
    expect(extractYouTubeVideoId('short')).toBe('short');
    expect(extractYouTubeVideoId('')).toBe('');
  });
});

describe('extractVideoIdFromBlobPath', () => {
  it('extracts ID from standard blob path', () => {
    expect(extractVideoIdFromBlobPath('transcripts/421T2iWTQio-1768890127930.md')).toBe('421T2iWTQio');
  });

  it('extracts ID from simple blob path', () => {
    expect(extractVideoIdFromBlobPath('transcripts/dQw4w9WgXcQ.md')).toBe('dQw4w9WgXcQ');
  });
});
