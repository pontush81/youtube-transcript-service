import { auth, clerkClient } from '@clerk/nextjs/server';
import { createHash, timingSafeEqual } from 'crypto';

export type UserRole = 'admin' | 'user';

export interface UserWithRole {
  userId: string;
  role: UserRole;
  email?: string;
}

/**
 * Timing-safe string comparison to prevent timing attacks.
 * Uses SHA-256 hashing to normalize buffer lengths before comparison,
 * preventing length-based timing leaks.
 */
export function secureCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const aHash = createHash('sha256').update(a).digest();
  const bHash = createHash('sha256').update(b).digest();
  return timingSafeEqual(aHash, bHash);
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
