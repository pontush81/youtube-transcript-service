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
