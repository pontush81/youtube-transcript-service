import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

// Admin endpoint to manually sync a subscription from Stripe data
// Protected by admin key header

export async function POST(request: NextRequest) {
  // Verify admin key
  const adminKey = request.headers.get('x-admin-key');
  if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { userId, stripeSubscriptionId, stripeCustomerId, currentPeriodEnd } = body;

    if (!userId || !stripeSubscriptionId || !stripeCustomerId || !currentPeriodEnd) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, stripeSubscriptionId, stripeCustomerId, currentPeriodEnd' },
        { status: 400 }
      );
    }

    // UPSERT the subscription
    await sql`
      INSERT INTO subscriptions (
        user_id,
        stripe_subscription_id,
        stripe_customer_id,
        status,
        current_period_end,
        created_at,
        updated_at
      )
      VALUES (
        ${userId},
        ${stripeSubscriptionId},
        ${stripeCustomerId},
        'active',
        ${new Date(currentPeriodEnd).toISOString()},
        NOW(),
        NOW()
      )
      ON CONFLICT (user_id)
      DO UPDATE SET
        stripe_subscription_id = ${stripeSubscriptionId},
        stripe_customer_id = ${stripeCustomerId},
        status = 'active',
        current_period_end = ${new Date(currentPeriodEnd).toISOString()},
        updated_at = NOW()
    `;

    return NextResponse.json({
      success: true,
      message: `Subscription synced for user ${userId}`
    });
  } catch (error) {
    console.error('Failed to sync subscription:', error);
    return NextResponse.json(
      { error: 'Failed to sync subscription' },
      { status: 500 }
    );
  }
}
