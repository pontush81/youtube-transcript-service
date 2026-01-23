# Security, Admin Roles & Architecture Improvements

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix critical security vulnerabilities, implement proper admin role management with Clerk, and improve architecture.

**Architecture:** Add Clerk metadata-based roles (admin/user), secure all unprotected endpoints with proper auth middleware, implement consistent error handling, and add rate limiting to fail-closed instead of fail-open.

**Tech Stack:** Next.js 16, Clerk (publicMetadata for roles), Zod validation, TypeScript

---

## Phase 1: Critical Security Fixes (P0)

### Task 1: Secure /api/db/setup endpoint

**Files:**
- Modify: `app/api/db/setup/route.ts`

**Step 1: Add admin key authentication**

Replace the entire file content with:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { setupDatabase } from '@/lib/db-schema';

function secureCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) {
    timingSafeEqual(aBuffer, aBuffer);
    return false;
  }
  return timingSafeEqual(aBuffer, bBuffer);
}

export async function POST(request: NextRequest) {
  const adminKey = request.headers.get('x-admin-key');
  const validKey = process.env.ADMIN_KEY;

  if (!adminKey || !validKey || !secureCompare(adminKey, validKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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

**Step 2: Verify the change works**

Run: `curl -s -X POST http://localhost:3000/api/db/setup | jq .`
Expected: `{ "error": "Unauthorized" }` with status 401

**Step 3: Commit**

```bash
git add app/api/db/setup/route.ts
git commit -m "fix(security): add admin key auth to /api/db/setup

BREAKING: Endpoint now requires x-admin-key header.
Prevents unauthorized database destruction."
```

---

### Task 2: Secure /api/embeddings/backfill endpoint

**Files:**
- Modify: `app/api/embeddings/backfill/route.ts`

**Step 1: Add admin key authentication at the top of POST handler**

Add imports and auth check at the beginning of the file:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { list } from '@vercel/blob';
import { sql } from '@/lib/db';
import { saveTranscriptEmbeddings } from '@/lib/embeddings';
import { extractYouTubeVideoId } from '@/lib/video-utils';
import { optimizeVectorIndex } from '@/lib/db-schema';

function secureCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) {
    timingSafeEqual(aBuffer, aBuffer);
    return false;
  }
  return timingSafeEqual(aBuffer, bBuffer);
}

export async function POST(request: NextRequest) {
  // Admin key required for this sensitive operation
  const adminKey = request.headers.get('x-admin-key');
  const validKey = process.env.ADMIN_KEY;

  if (!adminKey || !validKey || !secureCompare(adminKey, validKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // ... rest of existing code
```

**Step 2: Verify unauthorized access is blocked**

Run: `curl -s -X POST http://localhost:3000/api/embeddings/backfill | jq .`
Expected: `{ "error": "Unauthorized" }` with status 401

**Step 3: Commit**

```bash
git add app/api/embeddings/backfill/route.ts
git commit -m "fix(security): add admin key auth to /api/embeddings/backfill

CRITICAL: Prevents unauthorized deletion of all embeddings via ?clean=true"
```

---

### Task 3: Add Clerk auth to /api/summarize

**Files:**
- Modify: `app/api/summarize/route.ts`

**Step 1: Add Clerk auth and SSRF validation**

Add at the beginning of the file after imports:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { put, del } from '@vercel/blob';
import { auth } from '@clerk/nextjs/server';
import { isValidBlobUrl } from '@/lib/validations';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  // Require authentication
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: 'OpenAI API-nyckel saknas' },
      { status: 500 }
    );
  }

  try {
    const { blobUrl, title } = await request.json();

    if (!blobUrl) {
      return NextResponse.json(
        { success: false, error: 'Blob URL krävs' },
        { status: 400 }
      );
    }

    // SSRF protection: validate blob URL
    if (!isValidBlobUrl(blobUrl)) {
      return NextResponse.json(
        { success: false, error: 'Ogiltig blob URL' },
        { status: 400 }
      );
    }

    // ... rest of existing code (line 27 onwards from original)
```

**Step 2: Verify unauthorized access is blocked**

Run: `curl -s -X POST http://localhost:3000/api/summarize -H "Content-Type: application/json" -d '{"blobUrl":"test"}' | jq .`
Expected: `{ "error": "Unauthorized" }` with status 401

**Step 3: Commit**

```bash
git add app/api/summarize/route.ts
git commit -m "fix(security): add Clerk auth and SSRF protection to /api/summarize

- Requires authenticated user
- Validates blob URL against trusted domains
- Prevents API cost abuse and SSRF attacks"
```

---

### Task 4: Fix SSRF validation in /api/format (already has schema but needs auth)

**Files:**
- Modify: `app/api/format/route.ts`

**Step 1: Add Clerk auth check**

Add auth import and check after the imports:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { put, del } from '@vercel/blob';
import { formatRequestSchema, parseRequest } from '@/lib/validations';
import { auth } from '@clerk/nextjs/server';

// Vercel free tier har 10s timeout
export const maxDuration = 10;

// ... simpleFormat function stays the same ...

export async function POST(request: NextRequest) {
  // Require authentication
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // ... rest of existing code
```

**Step 2: Verify unauthorized access is blocked**

Run: `curl -s -X POST http://localhost:3000/api/format -H "Content-Type: application/json" -d '{"blobUrl":"test"}' | jq .`
Expected: `{ "error": "Unauthorized" }` with status 401

**Step 3: Commit**

```bash
git add app/api/format/route.ts
git commit -m "fix(security): add Clerk auth to /api/format

Requires authenticated user to format transcripts"
```

---

### Task 5: Fix timing-safe comparison in migrate routes

**Files:**
- Modify: `app/api/db/migrate-clerk/route.ts`
- Modify: `app/api/db/migrate-metadata/route.ts`

**Step 1: Update migrate-clerk to use timing-safe comparison**

Replace the auth check section:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { sql } from '@/lib/db';

function secureCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) {
    timingSafeEqual(aBuffer, aBuffer);
    return false;
  }
  return timingSafeEqual(aBuffer, bBuffer);
}

export async function POST(request: NextRequest) {
  const adminKey = request.headers.get('x-admin-key');
  const validKey = process.env.ADMIN_KEY;

  if (!adminKey || !validKey || !secureCompare(adminKey, validKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ... rest of migration code
```

**Step 2: Update migrate-metadata similarly**

Apply the same pattern to `app/api/db/migrate-metadata/route.ts`.

**Step 3: Commit**

```bash
git add app/api/db/migrate-clerk/route.ts app/api/db/migrate-metadata/route.ts
git commit -m "fix(security): use timing-safe comparison for admin key in migrate routes

Prevents timing attacks on admin key authentication"
```

---

## Phase 2: Admin Role Management with Clerk

### Task 6: Create admin utilities library

**Files:**
- Create: `lib/admin.ts`

**Step 1: Create the admin utilities file**

```typescript
import { auth, clerkClient } from '@clerk/nextjs/server';
import { timingSafeEqual } from 'crypto';

export type UserRole = 'admin' | 'user';

export interface UserWithRole {
  userId: string;
  role: UserRole;
  email?: string;
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
export function secureCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) {
    timingSafeEqual(aBuffer, aBuffer);
    return false;
  }
  return timingSafeEqual(aBuffer, bBuffer);
}

/**
 * Check if a user has admin role via Clerk metadata
 */
export async function isUserAdmin(userId: string): Promise<boolean> {
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    return user.publicMetadata?.role === 'admin';
  } catch {
    return false;
  }
}

/**
 * Get current user with role information
 */
export async function getCurrentUserWithRole(): Promise<UserWithRole | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const isAdmin = await isUserAdmin(userId);
  return {
    userId,
    role: isAdmin ? 'admin' : 'user',
  };
}

/**
 * Check if request has valid admin key (for API/CLI access)
 */
export function hasValidAdminKey(request: Request): boolean {
  const adminKey = request.headers.get('x-admin-key');
  const validKey = process.env.ADMIN_KEY;
  if (!adminKey || !validKey) return false;
  return secureCompare(adminKey, validKey);
}

/**
 * Require admin access - either via Clerk role or admin key
 * Returns userId if authorized, null if not
 */
export async function requireAdmin(request: Request): Promise<{
  authorized: boolean;
  userId: string | null;
  method: 'clerk' | 'apikey' | null;
}> {
  // Check admin key first (for API/CLI access)
  if (hasValidAdminKey(request)) {
    return { authorized: true, userId: null, method: 'apikey' };
  }

  // Check Clerk auth
  const { userId } = await auth();
  if (!userId) {
    return { authorized: false, userId: null, method: null };
  }

  const isAdmin = await isUserAdmin(userId);
  if (isAdmin) {
    return { authorized: true, userId, method: 'clerk' };
  }

  return { authorized: false, userId, method: null };
}

/**
 * Set user role in Clerk metadata (admin only operation)
 */
export async function setUserRole(targetUserId: string, role: UserRole): Promise<void> {
  const client = await clerkClient();
  await client.users.updateUserMetadata(targetUserId, {
    publicMetadata: { role },
  });
}

/**
 * Get all users with their roles (admin only)
 */
export async function getAllUsersWithRoles(limit = 100): Promise<UserWithRole[]> {
  const client = await clerkClient();
  const users = await client.users.getUserList({ limit });

  return users.data.map(user => ({
    userId: user.id,
    role: (user.publicMetadata?.role as UserRole) || 'user',
    email: user.emailAddresses[0]?.emailAddress,
  }));
}
```

**Step 2: Commit**

```bash
git add lib/admin.ts
git commit -m "feat(auth): add admin role utilities with Clerk metadata

- secureCompare for timing-safe comparisons
- isUserAdmin checks Clerk publicMetadata.role
- requireAdmin supports both Clerk roles and API key
- setUserRole to promote/demote users
- getAllUsersWithRoles for admin dashboard"
```

---

### Task 7: Create admin API endpoint

**Files:**
- Create: `app/api/admin/users/route.ts`

**Step 1: Create the admin users API**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import {
  requireAdmin,
  getAllUsersWithRoles,
  setUserRole,
  UserRole,
} from '@/lib/admin';
import { z } from 'zod';

// GET - List all users with roles
export async function GET(request: NextRequest) {
  const { authorized } = await requireAdmin(request);

  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const users = await getAllUsersWithRoles();
    return NextResponse.json({ users });
  } catch (error) {
    console.error('Failed to fetch users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

// PATCH - Update user role
const updateRoleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(['admin', 'user']),
});

export async function PATCH(request: NextRequest) {
  const { authorized } = await requireAdmin(request);

  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = updateRoleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { userId, role } = parsed.data;
    await setUserRole(userId, role as UserRole);

    return NextResponse.json({
      success: true,
      message: `User ${userId} role updated to ${role}`,
    });
  } catch (error) {
    console.error('Failed to update user role:', error);
    return NextResponse.json(
      { error: 'Failed to update user role' },
      { status: 500 }
    );
  }
}
```

**Step 2: Add route to middleware public routes**

In `middleware.ts`, add to `isPublicRoute`:
```typescript
'/api/admin/(.*)',    // Admin routes (use admin key or Clerk admin role)
```

**Step 3: Commit**

```bash
git add app/api/admin/users/route.ts middleware.ts
git commit -m "feat(admin): add user management API endpoint

GET /api/admin/users - list all users with roles
PATCH /api/admin/users - update user role (admin/user)

Requires either x-admin-key header or Clerk admin role"
```

---

### Task 8: Create script to set first admin

**Files:**
- Create: `scripts/set-admin.ts`

**Step 1: Create the admin setup script**

```typescript
/**
 * Script to set a user as admin
 * Usage: npx tsx scripts/set-admin.ts <user-email>
 *
 * Requires CLERK_SECRET_KEY environment variable
 */

import { createClerkClient } from '@clerk/backend';

async function main() {
  const email = process.argv[2];

  if (!email) {
    console.error('Usage: npx tsx scripts/set-admin.ts <user-email>');
    process.exit(1);
  }

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    console.error('CLERK_SECRET_KEY environment variable required');
    process.exit(1);
  }

  const clerk = createClerkClient({ secretKey });

  // Find user by email
  const users = await clerk.users.getUserList({
    emailAddress: [email],
  });

  if (users.data.length === 0) {
    console.error(`No user found with email: ${email}`);
    process.exit(1);
  }

  const user = users.data[0];
  console.log(`Found user: ${user.id} (${user.emailAddresses[0]?.emailAddress})`);

  // Set admin role
  await clerk.users.updateUserMetadata(user.id, {
    publicMetadata: { role: 'admin' },
  });

  console.log(`Successfully set ${email} as admin!`);
}

main().catch(console.error);
```

**Step 2: Add tsx to devDependencies if not present**

```bash
npm install -D tsx
```

**Step 3: Add script to package.json**

Add to scripts section:
```json
"set-admin": "tsx scripts/set-admin.ts"
```

**Step 4: Commit**

```bash
git add scripts/set-admin.ts package.json
git commit -m "feat(admin): add script to set user as admin

Usage: npm run set-admin <user-email>
Sets publicMetadata.role = 'admin' in Clerk"
```

---

## Phase 3: Rate Limiting Improvements

### Task 9: Make rate limiting fail-closed with circuit breaker

**Files:**
- Modify: `lib/rate-limit.ts`

**Step 1: Add circuit breaker pattern**

Replace the catch block in `checkRateLimit` function:

```typescript
// Track Redis failures for circuit breaker
let redisFailureCount = 0;
let lastFailureTime = 0;
const FAILURE_THRESHOLD = 3;
const RECOVERY_TIME_MS = 60000; // 1 minute

export async function checkRateLimit(
  type: RateLimitType,
  identifier: string
): Promise<RateLimitResult> {
  const limiter = limiters[type];

  // If Redis not configured, use in-memory fallback in dev only
  if (!limiter) {
    if (process.env.NODE_ENV === 'production') {
      console.error('CRITICAL: Rate limiting disabled in production!');
      // Fail closed in production if Redis not configured
      return {
        allowed: false,
        remaining: 0,
        resetAt: Date.now() + 60000,
        limit: 0,
      };
    }
    console.warn(`Rate limiting disabled: Redis not configured. Type: ${type}`);
    return {
      allowed: true,
      remaining: 999,
      resetAt: Date.now() + 60000,
      limit: 999,
    };
  }

  // Circuit breaker: if too many recent failures, fail closed
  const now = Date.now();
  if (redisFailureCount >= FAILURE_THRESHOLD) {
    if (now - lastFailureTime < RECOVERY_TIME_MS) {
      console.warn('Circuit breaker open: Rate limiting failing closed');
      return {
        allowed: false,
        remaining: 0,
        resetAt: lastFailureTime + RECOVERY_TIME_MS,
        limit: 0,
      };
    }
    // Recovery time passed, reset counter
    redisFailureCount = 0;
  }

  try {
    const result = await limiter.limit(identifier);
    // Success - reset failure counter
    redisFailureCount = 0;
    return {
      allowed: result.success,
      remaining: result.remaining,
      resetAt: result.reset,
      limit: result.limit,
    };
  } catch (error) {
    // Track failure
    redisFailureCount++;
    lastFailureTime = now;
    console.error(`Rate limit check failed (${redisFailureCount}/${FAILURE_THRESHOLD}):`, error);

    // Fail closed after threshold
    if (redisFailureCount >= FAILURE_THRESHOLD) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: now + RECOVERY_TIME_MS,
        limit: 0,
      };
    }

    // Allow single failures but warn
    return {
      allowed: true,
      remaining: 1,
      resetAt: now + 60000,
      limit: 30,
    };
  }
}
```

**Step 2: Commit**

```bash
git add lib/rate-limit.ts
git commit -m "fix(security): implement circuit breaker for rate limiting

- Fail closed in production if Redis not configured
- Circuit breaker pattern: 3 failures -> block for 1 minute
- Prevents abuse during Redis outages"
```

---

## Phase 4: Refactor to Use Admin Utilities

### Task 10: Update existing routes to use lib/admin.ts

**Files:**
- Modify: `app/api/db/setup/route.ts`
- Modify: `app/api/db/migrate-clerk/route.ts`
- Modify: `app/api/db/migrate-metadata/route.ts`
- Modify: `app/api/embeddings/backfill/route.ts`
- Modify: `app/api/metadata/backfill/route.ts`

**Step 1: Update all admin routes to use shared utility**

Example for `app/api/db/setup/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { hasValidAdminKey } from '@/lib/admin';
import { setupDatabase } from '@/lib/db-schema';

export async function POST(request: NextRequest) {
  if (!hasValidAdminKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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

Apply the same pattern to all other admin routes.

**Step 2: Commit**

```bash
git add app/api/db/ app/api/embeddings/ app/api/metadata/
git commit -m "refactor: use shared admin utilities in all admin routes

DRY: All admin routes now use lib/admin.ts for auth"
```

---

## Phase 5: Documentation

### Task 11: Update CLAUDE.md with admin documentation

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Add admin section**

Add to CLAUDE.md:

```markdown
## Admin Management

### Setting Up First Admin
```bash
# Requires CLERK_SECRET_KEY in .env.local
npm run set-admin your-email@example.com
```

### Admin API Endpoints
All require either `x-admin-key` header OR Clerk admin role.

- `GET /api/admin/users` - List all users with roles
- `PATCH /api/admin/users` - Update user role
  ```json
  { "userId": "user_xxx", "role": "admin" }
  ```

### Admin-Protected Routes
- `/api/db/setup` - Database initialization
- `/api/db/migrate-*` - Database migrations
- `/api/embeddings/backfill` - Rebuild embeddings
- `/api/metadata/backfill` - Fetch missing metadata

### User Roles
Stored in Clerk `publicMetadata.role`:
- `admin` - Full access to all routes and user management
- `user` (default) - Can only manage own transcripts
```

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add admin management documentation"
```

---

## Verification Checklist

After completing all tasks, verify:

1. **Security:**
   - [ ] `/api/db/setup` returns 401 without admin key
   - [ ] `/api/embeddings/backfill` returns 401 without admin key
   - [ ] `/api/summarize` returns 401 without Clerk auth
   - [ ] `/api/format` returns 401 without Clerk auth
   - [ ] Rate limiting fails closed after Redis errors in production

2. **Admin Roles:**
   - [ ] Can set admin via `npm run set-admin`
   - [ ] Admin users can access `/api/admin/users`
   - [ ] Admin users can update other users' roles
   - [ ] Regular users get 401 on admin endpoints

3. **Backwards Compatibility:**
   - [ ] All existing functionality works for authenticated users
   - [ ] Admin key still works for API/CLI access

---

## Summary

| Task | Priority | Impact |
|------|----------|--------|
| 1-4  | P0 | Fix critical auth vulnerabilities |
| 5    | P1 | Fix timing attack vulnerability |
| 6-8  | P1 | Implement proper admin role management |
| 9    | P1 | Make rate limiting fail-closed |
| 10   | P2 | DRY refactor for maintainability |
| 11   | P2 | Documentation |

**Total estimated tasks:** 11
**Commits:** 11
