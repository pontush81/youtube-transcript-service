# AI Chat Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a ChatGPT-like chat interface that lets users ask questions about their saved YouTube transcripts using RAG (Retrieval-Augmented Generation).

**Architecture:** Vector search with Vercel Postgres (pgvector) for finding relevant transcript chunks, OpenAI for embeddings and chat completions, streaming responses with source citations.

**Tech Stack:** Next.js 16, Vercel Postgres + pgvector, OpenAI (text-embedding-3-small, gpt-4o-mini), Vercel AI SDK for streaming.

---

## Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install required packages**

Run:
```bash
npm install @vercel/postgres ai openai
```

**Step 2: Verify installation**

Run: `npm ls @vercel/postgres ai openai`
Expected: All three packages listed without errors

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add postgres, ai sdk, and openai dependencies"
```

---

## Task 2: Set Up Vercel Postgres

**Files:**
- Create: `lib/db.ts`

**Step 1: Create Vercel Postgres database**

Run in Vercel Dashboard or CLI:
1. Go to https://vercel.com/dashboard → your project → Storage → Create Database → Postgres
2. Copy the connection strings to your `.env.local`

Or via CLI:
```bash
vercel link
vercel env pull .env.local
```

**Step 2: Create database connection helper**

Create `lib/db.ts`:

```typescript
import { sql } from '@vercel/postgres';

export { sql };
```

**Step 3: Commit**

```bash
git add lib/db.ts
git commit -m "feat: add Vercel Postgres connection"
```

---

## Task 3: Create Database Schema

**Files:**
- Create: `lib/db-schema.ts`
- Create: `app/api/db/setup/route.ts`

**Step 1: Create schema definition**

Create `lib/db-schema.ts`:

```typescript
import { sql } from '@/lib/db';

export async function setupDatabase() {
  // Enable pgvector extension
  await sql`CREATE EXTENSION IF NOT EXISTS vector`;

  // Create transcript_chunks table
  await sql`
    CREATE TABLE IF NOT EXISTS transcript_chunks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      blob_url TEXT NOT NULL,
      video_id TEXT NOT NULL,
      video_title TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      content TEXT NOT NULL,
      timestamp_start TEXT,
      embedding vector(1536),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  // Create index for vector search (if table has rows)
  await sql`
    CREATE INDEX IF NOT EXISTS transcript_chunks_embedding_idx
    ON transcript_chunks
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100)
  `;

  // Create index for video_id lookups
  await sql`
    CREATE INDEX IF NOT EXISTS transcript_chunks_video_id_idx
    ON transcript_chunks (video_id)
  `;

  return { success: true };
}
```

**Step 2: Create setup API endpoint**

Create `app/api/db/setup/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { setupDatabase } from '@/lib/db-schema';

export async function POST() {
  try {
    await setupDatabase();
    return NextResponse.json({ success: true, message: 'Database setup complete' });
  } catch (error) {
    console.error('Database setup error:', error);
    return NextResponse.json(
      { success: false, error: 'Database setup failed' },
      { status: 500 }
    );
  }
}
```

**Step 3: Run database setup**

Run: `curl -X POST http://localhost:3000/api/db/setup`
Expected: `{"success":true,"message":"Database setup complete"}`

**Step 4: Commit**

```bash
git add lib/db-schema.ts app/api/db/setup/route.ts
git commit -m "feat: add database schema with pgvector support"
```

---

## Task 4: Create Chunking Logic

**Files:**
- Create: `lib/chunking.ts`

**Step 1: Create chunking utility**

Create `lib/chunking.ts`:

```typescript
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
```

**Step 2: Commit**

```bash
git add lib/chunking.ts
git commit -m "feat: add transcript chunking logic"
```

---

## Task 5: Create AI Provider Abstraction

**Files:**
- Create: `lib/ai/types.ts`
- Create: `lib/ai/openai.ts`
- Create: `lib/ai/provider.ts`

**Step 1: Create types**

Create `lib/ai/types.ts`:

```typescript
export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface TranscriptChunk {
  content: string;
  videoId: string;
  videoTitle: string;
  timestampStart: string | null;
}

export interface ChatParams {
  messages: Message[];
  context: TranscriptChunk[];
  mode: 'strict' | 'hybrid';
}

export interface StreamChunk {
  content: string;
  done: boolean;
}

export interface Source {
  videoId: string;
  title: string;
  timestamp: string | null;
}

export interface AIProvider {
  chat(params: ChatParams): AsyncIterable<string>;
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}
```

**Step 2: Create OpenAI provider**

Create `lib/ai/openai.ts`:

```typescript
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
```

**Step 3: Create provider factory**

Create `lib/ai/provider.ts`:

```typescript
import { AIProvider } from './types';
import { OpenAIProvider } from './openai';

export function getAIProvider(name: 'openai' | 'claude' = 'openai'): AIProvider {
  switch (name) {
    case 'openai':
      return new OpenAIProvider();
    case 'claude':
      throw new Error('Claude provider not implemented yet');
    default:
      return new OpenAIProvider();
  }
}
```

**Step 4: Commit**

```bash
git add lib/ai/types.ts lib/ai/openai.ts lib/ai/provider.ts
git commit -m "feat: add AI provider abstraction with OpenAI implementation"
```

---

## Task 6: Create Embedding Storage Logic

**Files:**
- Create: `lib/embeddings.ts`

**Step 1: Create embeddings utility**

Create `lib/embeddings.ts`:

```typescript
import { sql } from '@/lib/db';
import { getAIProvider } from '@/lib/ai/provider';
import { chunkTranscript, Chunk } from '@/lib/chunking';

interface SaveEmbeddingsParams {
  blobUrl: string;
  videoId: string;
  videoTitle: string;
  markdownContent: string;
}

export async function saveTranscriptEmbeddings(params: SaveEmbeddingsParams): Promise<number> {
  const { blobUrl, videoId, videoTitle, markdownContent } = params;
  const provider = getAIProvider('openai');

  // Chunk the transcript
  const chunks = chunkTranscript(markdownContent);

  if (chunks.length === 0) {
    return 0;
  }

  // Generate embeddings in batch
  const embeddings = await provider.embedBatch(chunks.map(c => c.content));

  // Delete existing chunks for this video (in case of re-import)
  await sql`DELETE FROM transcript_chunks WHERE video_id = ${videoId}`;

  // Insert new chunks
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const embedding = embeddings[i];
    const embeddingStr = `[${embedding.join(',')}]`;

    await sql`
      INSERT INTO transcript_chunks (blob_url, video_id, video_title, chunk_index, content, timestamp_start, embedding)
      VALUES (${blobUrl}, ${videoId}, ${videoTitle}, ${chunk.chunkIndex}, ${chunk.content}, ${chunk.timestampStart}, ${embeddingStr}::vector)
    `;
  }

  return chunks.length;
}

export async function deleteTranscriptEmbeddings(videoId: string): Promise<void> {
  await sql`DELETE FROM transcript_chunks WHERE video_id = ${videoId}`;
}
```

**Step 2: Commit**

```bash
git add lib/embeddings.ts
git commit -m "feat: add embedding storage logic"
```

---

## Task 7: Create Vector Search Logic

**Files:**
- Create: `lib/vector-search.ts`

**Step 1: Create vector search utility**

Create `lib/vector-search.ts`:

```typescript
import { sql } from '@/lib/db';
import { getAIProvider } from '@/lib/ai/provider';
import { TranscriptChunk } from '@/lib/ai/types';

interface SearchParams {
  query: string;
  videoIds: string[] | 'all';
  minSimilarity?: number;
  maxChunksPerVideo?: number;
}

interface SearchResult extends TranscriptChunk {
  similarity: number;
}

export async function searchTranscripts(params: SearchParams): Promise<SearchResult[]> {
  const {
    query,
    videoIds,
    minSimilarity = 0.7,
    maxChunksPerVideo = 5
  } = params;

  const provider = getAIProvider('openai');

  // Generate embedding for the query
  const queryEmbedding = await provider.embed(query);
  const embeddingStr = `[${queryEmbedding.join(',')}]`;

  // Build the query based on video selection
  let results;

  if (videoIds === 'all') {
    results = await sql`
      WITH ranked AS (
        SELECT
          video_id,
          video_title,
          content,
          timestamp_start,
          1 - (embedding <=> ${embeddingStr}::vector) as similarity,
          ROW_NUMBER() OVER (PARTITION BY video_id ORDER BY embedding <=> ${embeddingStr}::vector) as rn
        FROM transcript_chunks
        WHERE 1 - (embedding <=> ${embeddingStr}::vector) >= ${minSimilarity}
      )
      SELECT video_id, video_title, content, timestamp_start, similarity
      FROM ranked
      WHERE rn <= ${maxChunksPerVideo}
      ORDER BY similarity DESC
      LIMIT 20
    `;
  } else {
    results = await sql`
      WITH ranked AS (
        SELECT
          video_id,
          video_title,
          content,
          timestamp_start,
          1 - (embedding <=> ${embeddingStr}::vector) as similarity,
          ROW_NUMBER() OVER (PARTITION BY video_id ORDER BY embedding <=> ${embeddingStr}::vector) as rn
        FROM transcript_chunks
        WHERE video_id = ANY(${videoIds})
          AND 1 - (embedding <=> ${embeddingStr}::vector) >= ${minSimilarity}
      )
      SELECT video_id, video_title, content, timestamp_start, similarity
      FROM ranked
      WHERE rn <= ${maxChunksPerVideo}
      ORDER BY similarity DESC
      LIMIT 20
    `;
  }

  return results.rows.map(row => ({
    videoId: row.video_id,
    videoTitle: row.video_title,
    content: row.content,
    timestampStart: row.timestamp_start,
    similarity: row.similarity,
  }));
}

export async function getIndexedVideoIds(): Promise<string[]> {
  const result = await sql`
    SELECT DISTINCT video_id FROM transcript_chunks ORDER BY video_id
  `;
  return result.rows.map(row => row.video_id);
}
```

**Step 2: Commit**

```bash
git add lib/vector-search.ts
git commit -m "feat: add vector search with dynamic relevance threshold"
```

---

## Task 8: Update Transcript Import to Generate Embeddings

**Files:**
- Modify: `app/api/transcript/route.ts`

**Step 1: Update transcript route**

Modify `app/api/transcript/route.ts` to add embedding generation after saving:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { extractVideoId, fetchTranscript, fetchVideoTitle } from '@/lib/youtube';
import { generateMarkdown } from '@/lib/markdown';
import { saveToBlob } from '@/lib/storage';
import { saveTranscriptEmbeddings } from '@/lib/embeddings';

// Remove edge runtime - Vercel Postgres doesn't work with Edge
// export const runtime = 'edge';

interface TranscriptRequest {
  url: string;
  submitter?: string;
  tags?: string[];
  notes?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: TranscriptRequest = await request.json();
    const { url, submitter, tags, notes } = body;

    if (!url) {
      return NextResponse.json(
        { success: false, error: 'YouTube URL krävs' },
        { status: 400 }
      );
    }

    const videoId = extractVideoId(url);

    if (!videoId) {
      return NextResponse.json(
        { success: false, error: 'Ogiltig YouTube URL' },
        { status: 400 }
      );
    }

    let title: string;
    try {
      title = await fetchVideoTitle(videoId);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Videon kunde inte hittas eller är privat' },
        { status: 404 }
      );
    }

    let transcript: string;
    try {
      transcript = await fetchTranscript(videoId);
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: 'Transkript saknas för denna video. Videon har förmodligen inga captions.',
        },
        { status: 404 }
      );
    }

    const markdown = generateMarkdown(transcript, {
      title,
      videoId,
      url,
      submitter,
      tags,
      notes,
      createdAt: new Date().toISOString(),
    });

    let downloadUrl: string;
    try {
      downloadUrl = await saveToBlob(videoId, markdown);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Kunde inte spara filen. Försök igen.' },
        { status: 500 }
      );
    }

    // Generate and save embeddings for chat functionality
    let chunksCreated = 0;
    try {
      chunksCreated = await saveTranscriptEmbeddings({
        blobUrl: downloadUrl,
        videoId,
        videoTitle: title,
        markdownContent: markdown,
      });
    } catch (error) {
      // Log but don't fail - embeddings are optional
      console.error('Failed to create embeddings:', error);
    }

    return NextResponse.json({
      success: true,
      videoId,
      title,
      downloadUrl,
      chunksCreated,
      preview: transcript.substring(0, 500) + (transcript.length > 500 ? '...' : ''),
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Ett oväntat fel uppstod' },
      { status: 500 }
    );
  }
}
```

**Step 2: Test the updated endpoint**

Run: `npm run dev`

Test with a YouTube URL and verify embeddings are created.

**Step 3: Commit**

```bash
git add app/api/transcript/route.ts
git commit -m "feat: generate embeddings when importing transcripts"
```

---

## Task 9: Create Backfill Endpoint for Existing Transcripts

**Files:**
- Create: `app/api/embeddings/backfill/route.ts`

**Step 1: Create backfill endpoint**

Create `app/api/embeddings/backfill/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { list } from '@vercel/blob';
import { saveTranscriptEmbeddings } from '@/lib/embeddings';
import { getIndexedVideoIds } from '@/lib/vector-search';

export async function POST() {
  try {
    const { blobs } = await list({ prefix: 'transcripts/' });
    const indexedVideoIds = await getIndexedVideoIds();

    const results: { videoId: string; status: string; chunks?: number }[] = [];

    for (const blob of blobs) {
      // Extract videoId from filename: transcripts/{videoId}-{timestamp}.md
      const filename = blob.pathname.replace('transcripts/', '').replace('.md', '');
      const parts = filename.split('-');
      const videoId = parts.slice(0, -1).join('-');

      // Skip if already indexed
      if (indexedVideoIds.includes(videoId)) {
        results.push({ videoId, status: 'skipped (already indexed)' });
        continue;
      }

      try {
        // Fetch the markdown content
        const response = await fetch(blob.url);
        const markdownContent = await response.text();

        // Extract title from markdown
        const firstLine = markdownContent.split('\n')[0];
        const title = firstLine?.startsWith('# ')
          ? firstLine.substring(2).trim()
          : videoId;

        // Generate embeddings
        const chunks = await saveTranscriptEmbeddings({
          blobUrl: blob.url,
          videoId,
          videoTitle: title,
          markdownContent,
        });

        results.push({ videoId, status: 'indexed', chunks });
      } catch (error) {
        results.push({
          videoId,
          status: `error: ${error instanceof Error ? error.message : 'unknown'}`
        });
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results
    });
  } catch (error) {
    console.error('Backfill error:', error);
    return NextResponse.json(
      { success: false, error: 'Backfill failed' },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit**

```bash
git add app/api/embeddings/backfill/route.ts
git commit -m "feat: add backfill endpoint for existing transcripts"
```

---

## Task 10: Create Chat API Endpoint

**Files:**
- Create: `app/api/chat/route.ts`

**Step 1: Create chat endpoint with streaming**

Create `app/api/chat/route.ts`:

```typescript
import { NextRequest } from 'next/server';
import { getAIProvider } from '@/lib/ai/provider';
import { searchTranscripts } from '@/lib/vector-search';
import { Message } from '@/lib/ai/types';

export const runtime = 'nodejs';
export const maxDuration = 30;

interface ChatRequest {
  message: string;
  conversationHistory: Message[];
  selectedVideos: string[] | 'all';
  mode: 'strict' | 'hybrid';
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const { message, conversationHistory, selectedVideos, mode } = body;

    if (!message?.trim()) {
      return new Response(
        JSON.stringify({ error: 'Meddelande krävs' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Search for relevant transcript chunks
    const relevantChunks = await searchTranscripts({
      query: message,
      videoIds: selectedVideos,
      minSimilarity: 0.7,
      maxChunksPerVideo: 5,
    });

    // Get AI provider
    const provider = getAIProvider('openai');

    // Build messages array
    const messages: Message[] = [
      ...conversationHistory,
      { role: 'user', content: message },
    ];

    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // First, send the sources as a JSON line
          const sources = [...new Map(
            relevantChunks.map(chunk => [
              chunk.videoId,
              {
                videoId: chunk.videoId,
                title: chunk.videoTitle,
                timestamp: chunk.timestampStart,
              }
            ])
          ).values()];

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'sources', sources })}\n\n`)
          );

          // Then stream the chat response
          for await (const text of provider.chat({ messages, context: relevantChunks, mode })) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'content', content: text })}\n\n`)
            );
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
          controller.close();
        } catch (error) {
          console.error('Stream error:', error);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'error', error: 'Ett fel uppstod' })}\n\n`)
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Chat error:', error);
    return new Response(
      JSON.stringify({ error: 'Ett fel uppstod' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
```

**Step 2: Commit**

```bash
git add app/api/chat/route.ts
git commit -m "feat: add chat API endpoint with streaming"
```

---

## Task 11: Create Chat UI Components - Types and Hook

**Files:**
- Create: `components/chat/types.ts`
- Create: `components/chat/useChat.ts`

**Step 1: Create shared types**

Create `components/chat/types.ts`:

```typescript
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  timestamp: Date;
}

export interface Source {
  videoId: string;
  title: string;
  timestamp: string | null;
}

export interface VideoOption {
  videoId: string;
  title: string;
  url: string;
}
```

**Step 2: Create useChat hook**

Create `components/chat/useChat.ts`:

```typescript
'use client';

import { useState, useCallback } from 'react';
import { ChatMessage, Source } from './types';

interface UseChatOptions {
  selectedVideos: string[] | 'all';
  mode: 'strict' | 'hybrid';
}

export function useChat({ selectedVideos, mode }: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    setError(null);
    setIsLoading(true);

    // Add user message
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    // Prepare assistant message placeholder
    const assistantMessageId = crypto.randomUUID();
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      sources: [],
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, assistantMessage]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          conversationHistory: messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
          selectedVideos,
          mode,
        }),
      });

      if (!response.ok) {
        throw new Error('Chat request failed');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;

          try {
            const data = JSON.parse(line.slice(6));

            if (data.type === 'sources') {
              setMessages(prev => prev.map(m =>
                m.id === assistantMessageId
                  ? { ...m, sources: data.sources }
                  : m
              ));
            } else if (data.type === 'content') {
              setMessages(prev => prev.map(m =>
                m.id === assistantMessageId
                  ? { ...m, content: m.content + data.content }
                  : m
              ));
            } else if (data.type === 'error') {
              setError(data.error);
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ett fel uppstod');
      // Remove the empty assistant message on error
      setMessages(prev => prev.filter(m => m.id !== assistantMessageId));
    } finally {
      setIsLoading(false);
    }
  }, [messages, selectedVideos, mode, isLoading]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearMessages,
  };
}
```

**Step 3: Commit**

```bash
git add components/chat/types.ts components/chat/useChat.ts
git commit -m "feat: add chat types and useChat hook"
```

---

## Task 12: Create Chat UI Components - Visual Components

**Files:**
- Create: `components/chat/MessageList.tsx`
- Create: `components/chat/MessageInput.tsx`
- Create: `components/chat/SourceList.tsx`

**Step 1: Create MessageList**

Create `components/chat/MessageList.tsx`:

```typescript
'use client';

import { ChatMessage } from './types';
import { SourceList } from './SourceList';

interface MessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        <div className="text-center">
          <p className="text-lg mb-2">Ställ en fråga om dina videor</p>
          <p className="text-sm">Välj vilka transkript som ska ingå i sökningen</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[80%] rounded-lg p-4 ${
              message.role === 'user'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-900'
            }`}
          >
            <p className="whitespace-pre-wrap">{message.content}</p>
            {message.role === 'assistant' && message.content === '' && isLoading && (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
              </div>
            )}
            {message.sources && message.sources.length > 0 && (
              <SourceList sources={message.sources} />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
```

**Step 2: Create MessageInput**

Create `components/chat/MessageInput.tsx`:

```typescript
'use client';

import { useState, FormEvent, KeyboardEvent } from 'react';

interface MessageInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function MessageInput({ onSend, disabled }: MessageInputProps) {
  const [input, setInput] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (input.trim() && !disabled) {
      onSend(input.trim());
      setInput('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border-t border-gray-200 p-4">
      <div className="flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Skriv ett meddelande..."
          disabled={disabled}
          rows={1}
          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none disabled:bg-gray-50"
        />
        <button
          type="submit"
          disabled={disabled || !input.trim()}
          className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
          </svg>
        </button>
      </div>
    </form>
  );
}
```

**Step 3: Create SourceList**

Create `components/chat/SourceList.tsx`:

```typescript
'use client';

import Link from 'next/link';
import { Source } from './types';

interface SourceListProps {
  sources: Source[];
}

export function SourceList({ sources }: SourceListProps) {
  if (sources.length === 0) return null;

  return (
    <div className="mt-3 pt-3 border-t border-gray-200">
      <p className="text-xs font-medium text-gray-500 mb-2">Källor:</p>
      <ul className="space-y-1">
        {sources.map((source, index) => (
          <li key={index}>
            <Link
              href={`/transcripts/${source.videoId}`}
              className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
            >
              {source.title}
              {source.timestamp && ` @ ${source.timestamp}`}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add components/chat/MessageList.tsx components/chat/MessageInput.tsx components/chat/SourceList.tsx
git commit -m "feat: add chat UI components"
```

---

## Task 13: Create Video Selector and Mode Toggle

**Files:**
- Create: `components/chat/VideoSelector.tsx`
- Create: `components/chat/ModeToggle.tsx`

**Step 1: Create VideoSelector**

Create `components/chat/VideoSelector.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { VideoOption } from './types';

interface VideoSelectorProps {
  videos: VideoOption[];
  selectedVideos: string[] | 'all';
  onChange: (selection: string[] | 'all') => void;
}

export function VideoSelector({ videos, selectedVideos, onChange }: VideoSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredVideos = videos.filter(v =>
    v.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isAllSelected = selectedVideos === 'all';
  const selectedSet = new Set(isAllSelected ? [] : selectedVideos);

  const handleToggleAll = () => {
    onChange(isAllSelected ? [] : 'all');
  };

  const handleToggleVideo = (videoId: string) => {
    if (isAllSelected) {
      // Switch from "all" to specific selection (all except this one)
      const allExceptThis = videos.map(v => v.videoId).filter(id => id !== videoId);
      onChange(allExceptThis);
    } else if (selectedSet.has(videoId)) {
      // Remove from selection
      const newSelection = [...selectedSet].filter(id => id !== videoId);
      onChange(newSelection);
    } else {
      // Add to selection
      onChange([...selectedSet, videoId]);
    }
  };

  return (
    <div className="h-full flex flex-col border-r border-gray-200">
      <div className="p-4 border-b border-gray-200">
        <h2 className="font-medium text-gray-900 mb-3">Transkript</h2>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Sök videor..."
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
        />
      </div>

      <div className="p-2 border-b border-gray-200">
        <label className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer">
          <input
            type="checkbox"
            checked={isAllSelected}
            onChange={handleToggleAll}
            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
          />
          <span className="text-sm font-medium">
            Alla ({videos.length})
          </span>
        </label>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {filteredVideos.map((video) => (
          <label
            key={video.videoId}
            className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer"
          >
            <input
              type="checkbox"
              checked={isAllSelected || selectedSet.has(video.videoId)}
              onChange={() => handleToggleVideo(video.videoId)}
              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            />
            <span className="text-sm truncate" title={video.title}>
              {video.title}
            </span>
          </label>
        ))}

        {filteredVideos.length === 0 && (
          <p className="text-sm text-gray-500 p-2">Inga videor hittades</p>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Create ModeToggle**

Create `components/chat/ModeToggle.tsx`:

```typescript
'use client';

interface ModeToggleProps {
  mode: 'strict' | 'hybrid';
  onChange: (mode: 'strict' | 'hybrid') => void;
}

export function ModeToggle({ mode, onChange }: ModeToggleProps) {
  return (
    <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
      <button
        onClick={() => onChange('strict')}
        className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
          mode === 'strict'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }`}
        title="Svarar endast baserat på transkript"
      >
        Endast transkript
      </button>
      <button
        onClick={() => onChange('hybrid')}
        className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
          mode === 'hybrid'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }`}
        title="Kan komplettera med allmän kunskap"
      >
        + Allmän kunskap
      </button>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add components/chat/VideoSelector.tsx components/chat/ModeToggle.tsx
git commit -m "feat: add VideoSelector and ModeToggle components"
```

---

## Task 14: Create Main Chat Window Component

**Files:**
- Create: `components/chat/ChatWindow.tsx`

**Step 1: Create ChatWindow**

Create `components/chat/ChatWindow.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { VideoSelector } from './VideoSelector';
import { ModeToggle } from './ModeToggle';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { useChat } from './useChat';
import { VideoOption } from './types';

export function ChatWindow() {
  const [videos, setVideos] = useState<VideoOption[]>([]);
  const [selectedVideos, setSelectedVideos] = useState<string[] | 'all'>('all');
  const [mode, setMode] = useState<'strict' | 'hybrid'>('strict');
  const [loadingVideos, setLoadingVideos] = useState(true);

  const { messages, isLoading, error, sendMessage, clearMessages } = useChat({
    selectedVideos,
    mode,
  });

  useEffect(() => {
    async function fetchVideos() {
      try {
        const response = await fetch('/api/transcripts');
        if (response.ok) {
          const data = await response.json();
          setVideos(data.transcripts.map((t: { videoId: string; title: string; url: string }) => ({
            videoId: t.videoId,
            title: t.title,
            url: t.url,
          })));
        }
      } catch (err) {
        console.error('Failed to fetch videos:', err);
      } finally {
        setLoadingVideos(false);
      }
    }
    fetchVideos();
  }, []);

  return (
    <div className="flex h-[calc(100vh-8rem)] bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Sidebar - Video selector */}
      <div className="w-72 flex-shrink-0 hidden md:block">
        {loadingVideos ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full" />
          </div>
        ) : (
          <VideoSelector
            videos={videos}
            selectedVideos={selectedVideos}
            onChange={setSelectedVideos}
          />
        )}
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h1 className="font-semibold text-gray-900">Transcript Chat</h1>
          <div className="flex items-center gap-4">
            <ModeToggle mode={mode} onChange={setMode} />
            {messages.length > 0 && (
              <button
                onClick={clearMessages}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Rensa
              </button>
            )}
          </div>
        </div>

        {/* Error display */}
        {error && (
          <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Messages */}
        <MessageList messages={messages} isLoading={isLoading} />

        {/* Input */}
        <MessageInput onSend={sendMessage} disabled={isLoading} />
      </div>
    </div>
  );
}
```

**Step 2: Create index export**

Create `components/chat/index.ts`:

```typescript
export { ChatWindow } from './ChatWindow';
```

**Step 3: Commit**

```bash
git add components/chat/ChatWindow.tsx components/chat/index.ts
git commit -m "feat: add main ChatWindow component"
```

---

## Task 15: Create Chat Page

**Files:**
- Create: `app/chat/page.tsx`

**Step 1: Create chat page**

Create `app/chat/page.tsx`:

```typescript
import Link from 'next/link';
import { ChatWindow } from '@/components/chat';

export default function ChatPage() {
  return (
    <main className="min-h-screen py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Transcript Chat
            </h1>
            <p className="text-gray-600 text-sm">
              Ställ frågor om dina sparade YouTube-transkript
            </p>
          </div>
          <Link
            href="/"
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Tillbaka till start
          </Link>
        </div>

        <ChatWindow />
      </div>
    </main>
  );
}
```

**Step 2: Commit**

```bash
git add app/chat/page.tsx
git commit -m "feat: add chat page"
```

---

## Task 16: Add Navigation to Chat

**Files:**
- Modify: `app/page.tsx`

**Step 1: Add chat link to home page**

Update `app/page.tsx` to add a link to the chat page:

```typescript
import Link from 'next/link';
import TranscriptForm from '@/components/TranscriptForm';

export default function Home() {
  return (
    <main className="min-h-screen py-12 px-4">
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            YouTube Transcript Service
          </h1>
          <p className="text-gray-600">
            Klistra in en YouTube-URL för att hämta transkriptet som Markdown-fil
          </p>
        </div>

        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
          <TranscriptForm />
        </div>

        <div className="mt-8 text-center space-y-3">
          <p className="text-sm text-gray-500">
            Fungerar med alla YouTube-videor som har captions aktiverade.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              href="/transcripts"
              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                <path
                  fillRule="evenodd"
                  d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z"
                  clipRule="evenodd"
                />
              </svg>
              Visa sparade transkript
            </Link>
            <Link
              href="/chat"
              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z"
                  clipRule="evenodd"
                />
              </svg>
              Chatta med transkript
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
```

**Step 2: Commit**

```bash
git add app/page.tsx
git commit -m "feat: add chat link to home page"
```

---

## Task 17: Test End-to-End

**Step 1: Start dev server**

Run: `npm run dev`

**Step 2: Set up database**

Visit: `http://localhost:3000/api/db/setup` (POST request)
Or run: `curl -X POST http://localhost:3000/api/db/setup`

**Step 3: Backfill existing transcripts**

Run: `curl -X POST http://localhost:3000/api/embeddings/backfill`

**Step 4: Test chat**

1. Visit `http://localhost:3000/chat`
2. Verify video list loads
3. Ask a question about a transcript
4. Verify streaming response works
5. Verify sources are shown

**Step 5: Verify build**

Run: `npm run build`
Expected: Build succeeds without errors

**Step 6: Final commit**

```bash
git add -A
git commit -m "feat: complete AI chat implementation"
```

---

## Summary

This plan implements the AI chat feature in 17 tasks:

1. **Tasks 1-3:** Set up dependencies, database connection, and schema
2. **Tasks 4-7:** Create chunking, AI provider, embeddings, and vector search logic
3. **Tasks 8-9:** Integrate embeddings into transcript import + backfill endpoint
4. **Task 10:** Create chat API with streaming
5. **Tasks 11-14:** Build all chat UI components
6. **Tasks 15-16:** Create chat page and add navigation
7. **Task 17:** End-to-end testing

**Environment variables needed:**
- `POSTGRES_URL` (from Vercel Postgres)
- `OPENAI_API_KEY` (existing)
