import { NextRequest, NextResponse } from 'next/server';
import { del } from '@vercel/blob';
import { timingSafeEqual } from 'crypto';
import { deleteRequestSchema, parseRequest } from '@/lib/validations';
import { checkRateLimit, getClientIdentifier, rateLimitHeaders } from '@/lib/rate-limit';

// Timing-safe string comparison to prevent timing attacks
function secureCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }

  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  // If lengths differ, compare against itself to maintain constant time
  if (aBuffer.length !== bBuffer.length) {
    timingSafeEqual(aBuffer, aBuffer);
    return false;
  }

  return timingSafeEqual(aBuffer, bBuffer);
}

export async function POST(request: NextRequest) {
  // Rate limiting to prevent brute force on admin key
  const clientId = getClientIdentifier(request);
  const rateLimit = await checkRateLimit('delete', clientId);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: 'För många försök. Vänta en stund.',
        retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
      },
      { status: 429, headers: rateLimitHeaders(rateLimit) }
    );
  }

  try {
    const rawBody = await request.json();
    const parsed = parseRequest(deleteRequestSchema, rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error },
        { status: 400 }
      );
    }

    const { blobUrl, adminKey } = parsed.data;

    // Secure admin key validation
    const validAdminKey = process.env.ADMIN_KEY;
    if (!validAdminKey || !secureCompare(adminKey, validAdminKey)) {
      return NextResponse.json(
        { success: false, error: 'Ogiltig admin-nyckel' },
        { status: 401 }
      );
    }

    // Radera från Vercel Blob
    await del(blobUrl);

    return NextResponse.json({
      success: true,
      message: 'Transkriptet har raderats',
    });
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json(
      { success: false, error: 'Kunde inte radera transkriptet' },
      { status: 500 }
    );
  }
}
