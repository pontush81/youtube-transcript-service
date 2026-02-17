import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { checkUsage, getUserPlan } from '@/lib/usage';

export async function GET() {
  const { userId } = await auth();

  let plan: 'free' | 'pro' = 'free';
  if (userId) {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    plan = getUserPlan(user.publicMetadata);
  }

  const [summary, chat] = await Promise.all([
    checkUsage(userId, 'summary', plan),
    checkUsage(userId, 'chat', plan),
  ]);

  return NextResponse.json({
    plan,
    summary: { used: summary.used, limit: summary.limit, remaining: summary.remaining },
    chat: { used: chat.used, limit: chat.limit, remaining: chat.remaining },
  });
}
