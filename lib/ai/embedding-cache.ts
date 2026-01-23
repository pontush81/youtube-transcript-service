/**
 * Simple LRU cache for embeddings to reduce API calls.
 * Stores embeddings by text hash with TTL.
 */

interface CacheEntry {
  embedding: number[];
  expiresAt: number;
}

// Simple hash function for cache keys
function hashText(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
}

class EmbeddingCache {
  private cache = new Map<string, CacheEntry>();
  private maxSize: number;
  private ttlMs: number;

  constructor(maxSize = 500, ttlMs = 30 * 60 * 1000) { // 500 entries, 30 min TTL
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  get(text: string): number[] | null {
    const key = hashText(text);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (LRU behavior with Map)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.embedding;
  }

  set(text: string, embedding: number[]): void {
    const key = hashText(text);

    // Evict oldest entries if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      embedding,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  // Get multiple embeddings, returning which were cached
  getMany(texts: string[]): { cached: Map<number, number[]>; uncached: number[] } {
    const cached = new Map<number, number[]>();
    const uncached: number[] = [];

    texts.forEach((text, index) => {
      const embedding = this.get(text);
      if (embedding) {
        cached.set(index, embedding);
      } else {
        uncached.push(index);
      }
    });

    return { cached, uncached };
  }

  // Set multiple embeddings
  setMany(texts: string[], embeddings: number[][]): void {
    texts.forEach((text, index) => {
      this.set(text, embeddings[index]);
    });
  }

  // Stats for monitoring
  stats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
    };
  }
}

// Singleton instance
export const embeddingCache = new EmbeddingCache();
