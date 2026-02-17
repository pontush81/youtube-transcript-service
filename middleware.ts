import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Routes that DON'T require authentication
// NOTE: Sign-up is public but should be restricted in Clerk Dashboard:
// Clerk Dashboard → Configure → Restrictions → Sign-up mode: "Restricted"
const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',        // Keep public for Clerk invites (restrict in Clerk Dashboard)
  '/api/webhooks/(.*)',  // Clerk webhooks
  '/api/webhook(.*)',    // Zapier webhook (uses API key + rate limiting)
  '/api/transcript',     // Chrome extension + public use (has rate limiting)
  '/api/summary',        // Chrome extension summary (has rate limiting)
  '/api/chat/extension', // Chrome extension chat (has rate limiting)
  '/api/usage',          // Usage status (works for both authed and anon)
  '/api/db/(.*)',        // Admin DB routes (use admin key)
  '/api/metadata/(.*)',  // Metadata backfill (use admin key)
  '/api/admin/(.*)',     // Admin routes (use admin key or Clerk admin role)
]);

// Security headers
function addSecurityHeaders(response: NextResponse) {
  const headers = response.headers;

  // Prevent clickjacking
  headers.set('X-Frame-Options', 'DENY');

  // Prevent MIME type sniffing
  headers.set('X-Content-Type-Options', 'nosniff');

  // Enable XSS filter (legacy browsers)
  headers.set('X-XSS-Protection', '1; mode=block');

  // Referrer policy
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions policy (disable unnecessary features)
  headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=()'
  );

  // HSTS - enforce HTTPS (1 year, include subdomains)
  if (process.env.NODE_ENV === 'production') {
    headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }

  // Content Security Policy - updated for Clerk
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com https://*.clerk.accounts.dev https://*.clerk.com https://challenges.cloudflare.com",
    "worker-src 'self' blob:",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.openai.com https://*.upstash.io https://*.vercel-storage.com https://*.youtube.com https://*.supadata.ai https://*.clerk.accounts.dev https://*.clerk.com https://clerk-telemetry.com",
    "frame-src 'self' https://www.youtube.com https://*.clerk.accounts.dev https://challenges.cloudflare.com",
    "frame-ancestors 'none'",
    "form-action 'self' https://*.clerk.accounts.dev",
    "base-uri 'self'",
    "object-src 'none'",
  ].join('; ');

  headers.set('Content-Security-Policy', csp);

  return response;
}

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();

  // Allow public routes without authentication
  if (isPublicRoute(req)) {
    const response = NextResponse.next();
    return addSecurityHeaders(response);
  }

  // Protect ALL other routes - redirect to sign-in if not authenticated
  if (!userId) {
    return NextResponse.redirect(new URL('/sign-in', req.url));
  }

  // Add security headers
  const response = NextResponse.next();
  return addSecurityHeaders(response);
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
