# Knowledge Base MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the YouTube transcript service into a personal knowledge base with web scraping and credit-based chat.

**Architecture:** Extend existing transcript pipeline to handle web content via Cheerio scraping. Add credit system (PostgreSQL table) that gates chat API. Stripe for purchases.

**Tech Stack:** Next.js 16, Cheerio (web scraping), Stripe (payments), PostgreSQL (credits), existing OpenAI embeddings.

---

## Task 1: Database Migration - Add Content Type Columns

**Files:**
- Create: `app/api/db/migrate-content-types/route.ts`

**Step 1: Create the migration endpoint**

```typescript
// app/api/db/migrate-content-types/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { isAdmin } from '@/lib/admin';
import { auth } from '@clerk/nextjs/server';

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  const adminKey = request.headers.get('x-admin-key');

  if (!adminKey && !(userId && await isAdmin(userId))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Add content_type column
    await sql`
      ALTER TABLE user_transcripts
      ADD COLUMN IF NOT EXISTS content_type TEXT DEFAULT 'youtube'
    `;

    // Add title column
    await sql`
      ALTER TABLE user_transcripts
      ADD COLUMN IF NOT EXISTS title TEXT
    `;

    // Add source_url column
    await sql`
      ALTER TABLE user_transcripts
      ADD COLUMN IF NOT EXISTS source_url TEXT
    `;

    // Add metadata column
    await sql`
      ALTER TABLE user_transcripts
      ADD COLUMN IF NOT EXISTS metadata JSONB
    `;

    // Backfill source_url for existing YouTube entries
    await sql`
      UPDATE user_transcripts
      SET source_url = 'https://youtube.com/watch?v=' || video_id
      WHERE source_url IS NULL AND content_type = 'youtube'
    `;

    return NextResponse.json({
      success: true,
      message: 'Content type columns added successfully'
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { error: 'Migration failed', details: String(error) },
      { status: 500 }
    );
  }
}
```

**Step 2: Test the migration locally**

Run: `curl -X POST http://localhost:3000/api/db/migrate-content-types -H "x-admin-key: $ADMIN_KEY"`

Expected: `{"success":true,"message":"Content type columns added successfully"}`

**Step 3: Commit**

```bash
git add app/api/db/migrate-content-types/route.ts
git commit -m "feat: add content type migration endpoint"
```

---

## Task 2: Database Migration - Create Credits Table

**Files:**
- Create: `app/api/db/migrate-credits/route.ts`

**Step 1: Create the credits migration endpoint**

```typescript
// app/api/db/migrate-credits/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { isAdmin } from '@/lib/admin';
import { auth } from '@clerk/nextjs/server';

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  const adminKey = request.headers.get('x-admin-key');

  if (!adminKey && !(userId && await isAdmin(userId))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Create user_credits table
    await sql`
      CREATE TABLE IF NOT EXISTS user_credits (
        user_id TEXT PRIMARY KEY,
        balance INTEGER DEFAULT 20,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // Create index for quick balance checks
    await sql`
      CREATE INDEX IF NOT EXISTS user_credits_balance_idx
      ON user_credits (balance)
      WHERE balance > 0
    `;

    // Give existing users 20 credits
    await sql`
      INSERT INTO user_credits (user_id, balance)
      SELECT DISTINCT user_id::TEXT, 20
      FROM user_transcripts
      WHERE user_id IS NOT NULL
      ON CONFLICT (user_id) DO NOTHING
    `;

    return NextResponse.json({
      success: true,
      message: 'Credits table created and existing users credited'
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { error: 'Migration failed', details: String(error) },
      { status: 500 }
    );
  }
}
```

**Step 2: Test the migration locally**

Run: `curl -X POST http://localhost:3000/api/db/migrate-credits -H "x-admin-key: $ADMIN_KEY"`

Expected: `{"success":true,"message":"Credits table created and existing users credited"}`

**Step 3: Commit**

```bash
git add app/api/db/migrate-credits/route.ts
git commit -m "feat: add credits table migration endpoint"
```

---

## Task 3: Credit System Library

**Files:**
- Create: `lib/credits.ts`

**Step 1: Create the credits library**

```typescript
// lib/credits.ts
import { sql } from '@/lib/db';

const DEFAULT_CREDITS = 20;

/**
 * Get current credit balance for a user.
 * Returns 0 if user has no credits record.
 */
export async function getCredits(userId: string): Promise<number> {
  const result = await sql`
    SELECT balance FROM user_credits WHERE user_id = ${userId}
  `;
  return result.rows[0]?.balance ?? 0;
}

/**
 * Use one credit for a chat query.
 * Returns true if credit was deducted, false if no credits available.
 * Uses atomic UPDATE to prevent race conditions.
 */
export async function useCredit(userId: string): Promise<boolean> {
  const result = await sql`
    UPDATE user_credits
    SET balance = balance - 1, updated_at = NOW()
    WHERE user_id = ${userId} AND balance > 0
    RETURNING balance
  `;
  return result.rows.length > 0;
}

/**
 * Add credits to a user's balance.
 * Creates the user record if it doesn't exist.
 */
export async function addCredits(userId: string, amount: number): Promise<number> {
  const result = await sql`
    INSERT INTO user_credits (user_id, balance, updated_at)
    VALUES (${userId}, ${amount}, NOW())
    ON CONFLICT (user_id)
    DO UPDATE SET
      balance = user_credits.balance + ${amount},
      updated_at = NOW()
    RETURNING balance
  `;
  return result.rows[0]?.balance ?? amount;
}

/**
 * Initialize credits for a new user.
 * Only creates record if one doesn't exist.
 */
export async function initializeCredits(userId: string): Promise<number> {
  const result = await sql`
    INSERT INTO user_credits (user_id, balance, updated_at)
    VALUES (${userId}, ${DEFAULT_CREDITS}, NOW())
    ON CONFLICT (user_id) DO NOTHING
    RETURNING balance
  `;

  // If insert happened, return the new balance
  if (result.rows.length > 0) {
    return result.rows[0].balance;
  }

  // Otherwise, get existing balance
  return getCredits(userId);
}

/**
 * Check if user has credits without consuming any.
 */
export async function hasCredits(userId: string): Promise<boolean> {
  const balance = await getCredits(userId);
  return balance > 0;
}
```

**Step 2: Commit**

```bash
git add lib/credits.ts
git commit -m "feat: add credit system library"
```

---

## Task 4: Credits API Endpoint

**Files:**
- Create: `app/api/credits/route.ts`

**Step 1: Create the credits API endpoint**

```typescript
// app/api/credits/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getCredits, initializeCredits } from '@/lib/credits';

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Initialize credits if new user, otherwise get existing
    const balance = await initializeCredits(userId);

    return NextResponse.json({ balance });
  } catch (error) {
    console.error('Credits fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch credits' },
      { status: 500 }
    );
  }
}
```

**Step 2: Test the endpoint**

Run: `curl http://localhost:3000/api/credits` (with auth cookie)

Expected: `{"balance":20}`

**Step 3: Commit**

```bash
git add app/api/credits/route.ts
git commit -m "feat: add credits API endpoint"
```

---

## Task 5: Add Credit Check to Chat API

**Files:**
- Modify: `app/api/chat/route.ts`

**Step 1: Import credits functions**

Add at top of file after existing imports:

```typescript
import { useCredit, hasCredits } from '@/lib/credits';
```

**Step 2: Add credit check after auth check**

Insert after the auth check block (after line 24), before rate limiting:

```typescript
  // Credit check
  const userHasCredits = await hasCredits(userId);
  if (!userHasCredits) {
    return new Response(
      JSON.stringify({
        error: 'Inga credits kvar. Köp fler för att fortsätta chatta.',
        code: 'NO_CREDITS'
      }),
      { status: 402, headers: { 'Content-Type': 'application/json' } }
    );
  }
```

**Step 3: Deduct credit before streaming response**

Insert just before `const encoder = new TextEncoder();` (around line 79):

```typescript
    // Deduct credit for this chat request
    const creditUsed = await useCredit(userId);
    if (!creditUsed) {
      return new Response(
        JSON.stringify({
          error: 'Inga credits kvar. Köp fler för att fortsätta chatta.',
          code: 'NO_CREDITS'
        }),
        { status: 402, headers: { 'Content-Type': 'application/json' } }
      );
    }
```

**Step 4: Test the endpoint**

1. With credits: Should return normal chat response
2. After using all credits: Should return 402 with `NO_CREDITS` code

**Step 5: Commit**

```bash
git add app/api/chat/route.ts
git commit -m "feat: add credit check to chat API"
```

---

## Task 6: URL Detector Library

**Files:**
- Create: `lib/url-detector.ts`

**Step 1: Create the URL detector**

```typescript
// lib/url-detector.ts

export type ContentType = 'youtube' | 'web';

const YOUTUBE_PATTERNS = [
  /^https?:\/\/(www\.)?youtube\.com\/watch\?v=/,
  /^https?:\/\/youtu\.be\//,
  /^https?:\/\/(www\.)?youtube\.com\/embed\//,
  /^https?:\/\/(www\.)?youtube\.com\/v\//,
  /^https?:\/\/(www\.)?youtube\.com\/shorts\//,
];

/**
 * Detect if a URL is YouTube or a regular web page.
 */
export function detectContentType(url: string): ContentType {
  const normalizedUrl = url.trim().toLowerCase();

  for (const pattern of YOUTUBE_PATTERNS) {
    if (pattern.test(normalizedUrl)) {
      return 'youtube';
    }
  }

  return 'web';
}

/**
 * Validate that a string is a valid URL.
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Extract domain from URL for metadata.
 */
export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return 'unknown';
  }
}
```

**Step 2: Commit**

```bash
git add lib/url-detector.ts
git commit -m "feat: add URL detector library"
```

---

## Task 7: Web Scraper Library

**Files:**
- Create: `lib/web-scraper.ts`
- Modify: `package.json` (add cheerio dependency)

**Step 1: Install cheerio**

Run: `npm install cheerio`

**Step 2: Create the web scraper**

```typescript
// lib/web-scraper.ts
import * as cheerio from 'cheerio';

export interface ScrapedContent {
  title: string;
  content: string;
  url: string;
  wordCount: number;
  domain: string;
}

const MAX_CONTENT_LENGTH = 50000; // Characters
const USER_AGENT = 'Mozilla/5.0 (compatible; KnowledgeBaseBot/1.0)';

// Selectors for content that should be removed
const REMOVE_SELECTORS = [
  'script',
  'style',
  'nav',
  'footer',
  'header',
  'aside',
  'noscript',
  'iframe',
  '.ads',
  '.ad',
  '.advertisement',
  '.comments',
  '.comment',
  '.sidebar',
  '.menu',
  '.navigation',
  '#comments',
  '#sidebar',
  '[role="navigation"]',
  '[role="banner"]',
  '[role="contentinfo"]',
].join(', ');

// Selectors for main content (tried in order)
const CONTENT_SELECTORS = [
  'article',
  '[role="main"]',
  'main',
  '.post-content',
  '.article-content',
  '.entry-content',
  '.content',
  '#content',
  '.post',
  '.article',
];

/**
 * Scrape content from a web URL.
 * Returns extracted title and main text content.
 */
export async function scrapeUrl(url: string): Promise<ScrapedContent> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9,sv;q=0.8',
    },
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    throw new Error(`URL is not HTML: ${contentType}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // Remove unwanted elements
  $(REMOVE_SELECTORS).remove();

  // Extract title
  const title = extractTitle($);

  // Extract main content
  let content = '';
  for (const selector of CONTENT_SELECTORS) {
    const element = $(selector).first();
    if (element.length > 0) {
      content = element.text();
      break;
    }
  }

  // Fallback to body if no main content found
  if (!content) {
    content = $('body').text();
  }

  // Clean up whitespace
  const cleanedContent = content
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_CONTENT_LENGTH);

  const domain = new URL(url).hostname.replace(/^www\./, '');

  return {
    title,
    content: cleanedContent,
    url,
    wordCount: cleanedContent.split(/\s+/).filter(w => w.length > 0).length,
    domain,
  };
}

function extractTitle($: cheerio.CheerioAPI): string {
  // Try og:title first
  const ogTitle = $('meta[property="og:title"]').attr('content');
  if (ogTitle) return ogTitle.trim();

  // Then regular title
  const title = $('title').text();
  if (title) return title.trim();

  // Then h1
  const h1 = $('h1').first().text();
  if (h1) return h1.trim();

  return 'Untitled';
}
```

**Step 3: Commit**

```bash
git add lib/web-scraper.ts package.json package-lock.json
git commit -m "feat: add web scraper with cheerio"
```

---

## Task 8: Content Embeddings for Web

**Files:**
- Modify: `lib/embeddings.ts`

**Step 1: Create saveWebContentEmbeddings function**

Add at the end of the file, before the closing:

```typescript
interface SaveWebEmbeddingsParams {
  blobUrl: string;
  contentId: string;
  title: string;
  content: string;
}

export async function saveWebContentEmbeddings(params: SaveWebEmbeddingsParams): Promise<SaveEmbeddingsResult> {
  const { blobUrl, contentId, title, content } = params;

  // Validate content
  if (!content || content.length < 200) {
    return {
      chunksCreated: 0,
      normalizedVideoId: contentId,
      validation: {
        valid: false,
        reason: 'Content too short (less than 200 characters)',
        contentLength: content?.length || 0,
      },
    };
  }

  const provider = getAIProvider('openai');

  // Chunk the content (reuse existing chunking logic)
  // Create a simple markdown wrapper to use existing chunker
  const markdownContent = `# ${title}\n\n---\n\n${content}`;
  const chunks = chunkTranscript(markdownContent);

  if (chunks.length === 0) {
    return {
      chunksCreated: 0,
      normalizedVideoId: contentId,
      validation: {
        valid: false,
        reason: 'No chunks created from content',
        contentLength: content.length,
      },
    };
  }

  // Generate embeddings in batch
  const embeddings = await provider.embedBatch(chunks.map(c => c.content));

  // Delete existing chunks for this content
  await sql`DELETE FROM transcript_chunks WHERE video_id = ${contentId}`;

  // Insert chunks
  if (chunks.length > 0) {
    await Promise.all(
      chunks.map((chunk, i) => {
        const embedding = embeddings[i];
        const embeddingStr = `[${embedding.join(',')}]`;
        return sql`
          INSERT INTO transcript_chunks (blob_url, video_id, video_title, chunk_index, content, timestamp_start, embedding)
          VALUES (${blobUrl}, ${contentId}, ${title}, ${chunk.chunkIndex}, ${chunk.content}, ${null}, ${embeddingStr}::vector)
        `;
      })
    );
  }

  return {
    chunksCreated: chunks.length,
    normalizedVideoId: contentId,
    validation: {
      valid: true,
      contentLength: content.length,
    },
  };
}
```

**Step 2: Commit**

```bash
git add lib/embeddings.ts
git commit -m "feat: add web content embeddings support"
```

---

## Task 9: Unified Add Content API

**Files:**
- Create: `app/api/add/route.ts`

**Step 1: Create the unified add endpoint**

```typescript
// app/api/add/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { sql } from '@/lib/db';
import { detectContentType, isValidUrl, extractDomain } from '@/lib/url-detector';
import { scrapeUrl } from '@/lib/web-scraper';
import { saveWebContentEmbeddings, saveTranscriptEmbeddings } from '@/lib/embeddings';
import { saveToBlob } from '@/lib/storage';
import { extractVideoId, fetchTranscript, fetchVideoTitle } from '@/lib/youtube';
import { generateMarkdown } from '@/lib/markdown';
import { fetchAndSaveVideoMetadata } from '@/lib/video-metadata';
import { checkRateLimit, getClientIdentifier, rateLimitHeaders } from '@/lib/rate-limit';
import { z } from 'zod';

const addContentSchema = z.object({
  url: z.string().url('Ogiltig URL'),
});

export async function POST(request: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limiting
  const clientId = getClientIdentifier(request);
  const rateLimit = await checkRateLimit('transcript', clientId);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'För många förfrågningar. Vänta en stund.' },
      { status: 429, headers: rateLimitHeaders(rateLimit) }
    );
  }

  try {
    const body = await request.json();
    const parsed = addContentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Ogiltig förfrågan' },
        { status: 400 }
      );
    }

    const { url } = parsed.data;

    if (!isValidUrl(url)) {
      return NextResponse.json({ error: 'Ogiltig URL' }, { status: 400 });
    }

    const contentType = detectContentType(url);

    if (contentType === 'youtube') {
      return handleYouTube(url, userId);
    } else {
      return handleWebContent(url, userId);
    }
  } catch (error) {
    console.error('Add content error:', error);
    return NextResponse.json(
      { error: 'Ett oväntat fel uppstod' },
      { status: 500 }
    );
  }
}

async function handleYouTube(url: string, userId: string) {
  const videoId = extractVideoId(url);

  if (!videoId) {
    return NextResponse.json({ error: 'Ogiltig YouTube URL' }, { status: 400 });
  }

  // Fetch title
  let title: string;
  try {
    title = await fetchVideoTitle(videoId);
  } catch {
    return NextResponse.json(
      { error: 'Videon kunde inte hittas eller är privat' },
      { status: 404 }
    );
  }

  // Fetch transcript
  let transcript: string;
  try {
    transcript = await fetchTranscript(videoId);
  } catch {
    return NextResponse.json(
      { error: 'Transkript saknas för denna video' },
      { status: 404 }
    );
  }

  // Generate markdown and save
  const markdown = generateMarkdown(transcript, {
    title,
    videoId,
    url,
    createdAt: new Date().toISOString(),
  });

  const blobUrl = await saveToBlob(videoId, markdown);

  // Create embeddings
  await saveTranscriptEmbeddings({
    blobUrl,
    videoId,
    videoTitle: title,
    markdownContent: markdown,
  });

  // Fetch metadata
  try {
    await fetchAndSaveVideoMetadata(videoId);
  } catch (error) {
    console.error('Failed to save video metadata:', error);
  }

  // Save to user_transcripts
  await sql`
    INSERT INTO user_transcripts (user_id, video_id, blob_url, is_public, content_type, title, source_url)
    VALUES (${userId}, ${videoId}, ${blobUrl}, true, 'youtube', ${title}, ${url})
    ON CONFLICT (user_id, video_id) DO UPDATE SET
      blob_url = EXCLUDED.blob_url,
      title = EXCLUDED.title,
      source_url = EXCLUDED.source_url
  `;

  return NextResponse.json({
    success: true,
    contentType: 'youtube',
    title,
    id: videoId,
    url: blobUrl,
  });
}

async function handleWebContent(url: string, userId: string) {
  // Scrape the web page
  let scraped;
  try {
    scraped = await scrapeUrl(url);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Kunde inte hämta sidan';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (scraped.wordCount < 50) {
    return NextResponse.json(
      { error: 'Sidan har för lite innehåll att spara' },
      { status: 400 }
    );
  }

  // Generate unique content ID
  const contentId = `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Create markdown content
  const markdown = `# ${scraped.title}

> Källa: [${scraped.domain}](${url})
> Hämtad: ${new Date().toISOString()}
> Ord: ${scraped.wordCount}

---

${scraped.content}
`;

  // Save to blob
  const blobUrl = await saveToBlob(contentId, markdown);

  // Create embeddings
  await saveWebContentEmbeddings({
    blobUrl,
    contentId,
    title: scraped.title,
    content: scraped.content,
  });

  // Save to user_transcripts
  const metadata = {
    domain: scraped.domain,
    word_count: scraped.wordCount,
    scraped_at: new Date().toISOString(),
  };

  await sql`
    INSERT INTO user_transcripts (user_id, video_id, blob_url, is_public, content_type, title, source_url, metadata)
    VALUES (${userId}, ${contentId}, ${blobUrl}, true, 'web', ${scraped.title}, ${url}, ${JSON.stringify(metadata)})
    ON CONFLICT (user_id, video_id) DO UPDATE SET
      blob_url = EXCLUDED.blob_url,
      title = EXCLUDED.title,
      source_url = EXCLUDED.source_url,
      metadata = EXCLUDED.metadata
  `;

  return NextResponse.json({
    success: true,
    contentType: 'web',
    title: scraped.title,
    id: contentId,
    url: blobUrl,
    wordCount: scraped.wordCount,
  });
}
```

**Step 2: Commit**

```bash
git add app/api/add/route.ts
git commit -m "feat: add unified content add endpoint (YouTube + web)"
```

---

## Task 10: Stripe Checkout Endpoint

**Files:**
- Create: `app/api/checkout/route.ts`
- Modify: `package.json` (add stripe dependency)

**Step 1: Install stripe**

Run: `npm install stripe`

**Step 2: Create the checkout endpoint**

```typescript
// app/api/checkout/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import Stripe from 'stripe';
import { z } from 'zod';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
});

const CREDIT_PACKAGES: Record<string, { priceId: string; credits: number; name: string }> = {
  starter: {
    priceId: process.env.STRIPE_PRICE_STARTER!,
    credits: 100,
    name: 'Starter (100 credits)'
  },
  pro: {
    priceId: process.env.STRIPE_PRICE_PRO!,
    credits: 500,
    name: 'Pro (500 credits)'
  },
  mega: {
    priceId: process.env.STRIPE_PRICE_MEGA!,
    credits: 2000,
    name: 'Mega (2000 credits)'
  },
};

const checkoutSchema = z.object({
  package: z.enum(['starter', 'pro', 'mega']),
});

export async function POST(request: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = checkoutSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Ogiltigt paket' }, { status: 400 });
    }

    const creditPackage = CREDIT_PACKAGES[parsed.data.package];

    if (!creditPackage || !creditPackage.priceId) {
      return NextResponse.json(
        { error: 'Paketet är inte konfigurerat' },
        { status: 500 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price: creditPackage.priceId,
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/credits?success=true`,
      cancel_url: `${baseUrl}/credits?canceled=true`,
      metadata: {
        userId,
        credits: creditPackage.credits.toString(),
        package: parsed.data.package,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json(
      { error: 'Kunde inte skapa checkout-session' },
      { status: 500 }
    );
  }
}
```

**Step 3: Commit**

```bash
git add app/api/checkout/route.ts package.json package-lock.json
git commit -m "feat: add Stripe checkout endpoint"
```

---

## Task 11: Stripe Webhook

**Files:**
- Create: `app/api/webhooks/stripe/route.ts`

**Step 1: Create the Stripe webhook**

```typescript
// app/api/webhooks/stripe/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { addCredits } from '@/lib/credits';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
});

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const { userId, credits } = session.metadata || {};

    if (userId && credits) {
      try {
        const newBalance = await addCredits(userId, parseInt(credits, 10));
        console.log(`Added ${credits} credits to user ${userId}. New balance: ${newBalance}`);
      } catch (error) {
        console.error('Failed to add credits:', error);
        // Don't return error - Stripe will retry
      }
    } else {
      console.error('Missing metadata in checkout session:', session.id);
    }
  }

  return NextResponse.json({ received: true });
}
```

**Step 2: Commit**

```bash
git add app/api/webhooks/stripe/route.ts
git commit -m "feat: add Stripe webhook for credit purchases"
```

---

## Task 12: Credits Display Component

**Files:**
- Create: `components/credit-display.tsx`

**Step 1: Create the credit display component**

```typescript
// components/credit-display.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export function CreditDisplay() {
  const [credits, setCredits] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCredits() {
      try {
        const res = await fetch('/api/credits');
        if (res.ok) {
          const data = await res.json();
          setCredits(data.balance);
        }
      } catch (error) {
        console.error('Failed to fetch credits:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchCredits();
  }, []);

  if (loading) {
    return <span className="text-gray-400">...</span>;
  }

  if (credits === null) {
    return null;
  }

  const isLow = credits <= 5;

  return (
    <Link
      href="/credits"
      className={`flex items-center gap-1 px-2 py-1 rounded text-sm ${
        isLow
          ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
          : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
      }`}
    >
      <span>{credits}</span>
      <span className="hidden sm:inline">credits</span>
    </Link>
  );
}
```

**Step 2: Commit**

```bash
git add components/credit-display.tsx
git commit -m "feat: add credit display component"
```

---

## Task 13: Credits Page

**Files:**
- Create: `app/credits/page.tsx`

**Step 1: Create the credits page**

```typescript
// app/credits/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

const PACKAGES = [
  { id: 'starter', name: 'Starter', credits: 100, price: 49, perCredit: '0.49' },
  { id: 'pro', name: 'Pro', credits: 500, price: 149, perCredit: '0.30', popular: true },
  { id: 'mega', name: 'Mega', credits: 2000, price: 449, perCredit: '0.22' },
];

export default function CreditsPage() {
  const [credits, setCredits] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const searchParams = useSearchParams();

  const success = searchParams.get('success') === 'true';
  const canceled = searchParams.get('canceled') === 'true';

  useEffect(() => {
    async function fetchCredits() {
      try {
        const res = await fetch('/api/credits');
        if (res.ok) {
          const data = await res.json();
          setCredits(data.balance);
        }
      } catch (error) {
        console.error('Failed to fetch credits:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchCredits();
  }, []);

  async function handlePurchase(packageId: string) {
    setPurchasing(packageId);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ package: packageId }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
        }
      } else {
        alert('Något gick fel. Försök igen.');
      }
    } catch (error) {
      console.error('Purchase error:', error);
      alert('Något gick fel. Försök igen.');
    } finally {
      setPurchasing(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-2">Credits</h1>
        <p className="text-center text-gray-600 dark:text-gray-400 mb-8">
          Köp credits för att chatta med din kunskapsbas
        </p>

        {success && (
          <div className="mb-8 p-4 bg-green-100 text-green-700 rounded-lg text-center">
            Köpet genomfördes! Dina credits har lagts till.
          </div>
        )}

        {canceled && (
          <div className="mb-8 p-4 bg-yellow-100 text-yellow-700 rounded-lg text-center">
            Köpet avbröts.
          </div>
        )}

        <div className="text-center mb-8">
          <div className="inline-block bg-white dark:bg-gray-800 rounded-lg px-6 py-4 shadow">
            <span className="text-gray-600 dark:text-gray-400">Ditt saldo: </span>
            <span className="text-2xl font-bold">
              {loading ? '...' : credits ?? 0}
            </span>
            <span className="text-gray-600 dark:text-gray-400"> credits</span>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {PACKAGES.map((pkg) => (
            <div
              key={pkg.id}
              className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 ${
                pkg.popular ? 'ring-2 ring-blue-500' : ''
              }`}
            >
              {pkg.popular && (
                <div className="text-center mb-2">
                  <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                    Populär
                  </span>
                </div>
              )}
              <h2 className="text-xl font-bold text-center mb-2">{pkg.name}</h2>
              <div className="text-center mb-4">
                <span className="text-3xl font-bold">{pkg.credits}</span>
                <span className="text-gray-600 dark:text-gray-400"> credits</span>
              </div>
              <div className="text-center mb-4">
                <span className="text-2xl font-bold">{pkg.price} kr</span>
              </div>
              <div className="text-center text-sm text-gray-500 mb-6">
                {pkg.perCredit} kr per fråga
              </div>
              <button
                onClick={() => handlePurchase(pkg.id)}
                disabled={purchasing !== null}
                className={`w-full py-3 rounded-lg font-semibold transition ${
                  pkg.popular
                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                    : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
                } disabled:opacity-50`}
              >
                {purchasing === pkg.id ? 'Laddar...' : 'Köp'}
              </button>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center text-sm text-gray-500">
          <p>1 credit = 1 chattfråga</p>
          <p>Att lägga till innehåll är gratis</p>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add app/credits/page.tsx
git commit -m "feat: add credits purchase page"
```

---

## Task 14: Environment Variables Documentation

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Add new environment variables to documentation**

Add under `## Miljövariabler` section:

```markdown
### Stripe (för credits)
- `STRIPE_SECRET_KEY` - Stripe API secret key
- `STRIPE_WEBHOOK_SECRET` - Webhook signing secret
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Stripe publishable key
- `STRIPE_PRICE_STARTER` - Price ID för 100 credits (49 kr)
- `STRIPE_PRICE_PRO` - Price ID för 500 credits (149 kr)
- `STRIPE_PRICE_MEGA` - Price ID för 2000 credits (449 kr)
```

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add Stripe environment variables"
```

---

## Task 15: Final Integration Test

**Steps:**

1. Run migrations:
   ```bash
   curl -X POST http://localhost:3000/api/db/migrate-content-types -H "x-admin-key: $ADMIN_KEY"
   curl -X POST http://localhost:3000/api/db/migrate-credits -H "x-admin-key: $ADMIN_KEY"
   ```

2. Test adding YouTube content:
   ```bash
   curl -X POST http://localhost:3000/api/add \
     -H "Content-Type: application/json" \
     -d '{"url":"https://youtube.com/watch?v=dQw4w9WgXcQ"}'
   ```

3. Test adding web content:
   ```bash
   curl -X POST http://localhost:3000/api/add \
     -H "Content-Type: application/json" \
     -d '{"url":"https://example.com"}'
   ```

4. Test credits endpoint:
   ```bash
   curl http://localhost:3000/api/credits
   ```

5. Test chat with credit deduction (should work until credits run out)

6. Test Stripe checkout (use test mode)

**Commit:**

```bash
git add -A
git commit -m "feat: knowledge base MVP complete"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Content type migration | `api/db/migrate-content-types/route.ts` |
| 2 | Credits table migration | `api/db/migrate-credits/route.ts` |
| 3 | Credits library | `lib/credits.ts` |
| 4 | Credits API | `api/credits/route.ts` |
| 5 | Chat credit check | `api/chat/route.ts` (modify) |
| 6 | URL detector | `lib/url-detector.ts` |
| 7 | Web scraper | `lib/web-scraper.ts` |
| 8 | Web embeddings | `lib/embeddings.ts` (modify) |
| 9 | Unified add API | `api/add/route.ts` |
| 10 | Stripe checkout | `api/checkout/route.ts` |
| 11 | Stripe webhook | `api/webhooks/stripe/route.ts` |
| 12 | Credit display | `components/credit-display.tsx` |
| 13 | Credits page | `app/credits/page.tsx` |
| 14 | Docs update | `CLAUDE.md` (modify) |
| 15 | Integration test | Manual verification |
