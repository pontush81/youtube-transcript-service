import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { sql } from '@/lib/db';
import { detectContentType, isValidUrl } from '@/lib/url-detector';
import { scrapeUrl } from '@/lib/web-scraper';
import { saveWebContentEmbeddings, saveTranscriptEmbeddings } from '@/lib/embeddings';
import { saveToBlob } from '@/lib/storage';
import { extractVideoId, fetchTranscript, fetchVideoTitle } from '@/lib/youtube';
import { generateMarkdown } from '@/lib/markdown';
import { fetchAndSaveVideoMetadata } from '@/lib/video-metadata';
import { checkRateLimit, getClientIdentifier, rateLimitHeaders } from '@/lib/rate-limit';
import { canUse, logUsage } from '@/lib/usage';
import { isUserAdmin } from '@/lib/admin';
import { z } from 'zod';

const addContentSchema = z.object({
  url: z.string().url('Ogiltig URL'),
});

export async function POST(request: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Usage check (skip for admins)
  const isAdmin = await isUserAdmin(userId);
  if (!isAdmin) {
    const allowed = await canUse(userId, 'transcript');
    if (!allowed) {
      return NextResponse.json(
        {
          error: 'Du har nått din dagliga gräns. Uppgradera till Pro för mer.',
          code: 'USAGE_LIMIT'
        },
        { status: 402 }
      );
    }
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
        { error: parsed.error.issues[0]?.message || 'Ogiltig förfrågan' },
        { status: 400 }
      );
    }

    const { url } = parsed.data;

    if (!isValidUrl(url)) {
      return NextResponse.json({ error: 'Ogiltig URL' }, { status: 400 });
    }

    const contentType = detectContentType(url);

    if (contentType === 'youtube') {
      return handleYouTube(url, userId, isAdmin);
    } else {
      return handleWebContent(url, userId, isAdmin);
    }
  } catch (error) {
    console.error('Add content error:', error);
    return NextResponse.json(
      { error: 'Ett oväntat fel uppstod' },
      { status: 500 }
    );
  }
}

async function handleYouTube(url: string, userId: string, isAdmin: boolean) {
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

  // Log usage (only for non-admins)
  if (!isAdmin) {
    await logUsage(userId, 'transcript');
  }

  return NextResponse.json({
    success: true,
    contentType: 'youtube',
    title,
    id: videoId,
    url: blobUrl,
  });
}

async function handleWebContent(url: string, userId: string, isAdmin: boolean) {
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

  // Log usage (only for non-admins)
  if (!isAdmin) {
    await logUsage(userId, 'transcript');
  }

  return NextResponse.json({
    success: true,
    contentType: 'web',
    title: scraped.title,
    id: contentId,
    url: blobUrl,
    wordCount: scraped.wordCount,
  });
}
