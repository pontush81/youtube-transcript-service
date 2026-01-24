import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getUserPlan } from '@/lib/usage';

export const runtime = 'nodejs';

/**
 * GET /api/usage
 * Returns the current user's plan and usage information.
 * Used by UsageDisplay component and Pricing page.
 */
export async function GET() {
  // Require authentication
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const userPlan = await getUserPlan(userId);

    // Transform to API response format
    const response = {
      plan: userPlan.plan,
      usage: {
        chats: userPlan.limits.chats,
        transcripts: userPlan.limits.transcripts,
      },
      subscription: userPlan.subscription
        ? {
            status: userPlan.subscription.status,
            renewsAt: userPlan.subscription.currentPeriodEnd?.toISOString() ?? null,
          }
        : null,
    };

    return NextResponse.json(response, {
      headers: {
        // Private, user-specific data - don't cache
        'Cache-Control': 'private, no-cache',
      },
    });
  } catch (error) {
    console.error('Error fetching user plan:', error);
    return NextResponse.json(
      { error: 'Kunde inte hämta användningsdata' },
      { status: 500 }
    );
  }
}
