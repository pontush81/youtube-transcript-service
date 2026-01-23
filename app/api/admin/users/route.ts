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
