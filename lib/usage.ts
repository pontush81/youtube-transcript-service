import { sql } from '@/lib/db';

// ==========================================
// Types
// ==========================================

export type UsageType = 'chat' | 'transcript';

export interface UsageLimits {
  chats: { used: number; limit: number };
  transcripts: { used: number; limit: number };
}

export interface UserPlan {
  plan: 'free' | 'pro';
  limits: UsageLimits;
  subscription?: {
    status: string;
    currentPeriodEnd: Date | null;
  };
}

// ==========================================
// Constants
// ==========================================

export const FREE_LIMITS = {
  chatsPerDay: 5,
  transcriptsPerDay: 3,
} as const;

export const PRO_LIMITS = {
  chatsPerMonth: 1000,
  transcriptsPerMonth: 200,
} as const;

// ==========================================
// Functions
// ==========================================

/**
 * Check if user has an active Pro subscription.
 * Returns true if status='active' AND current_period_end > NOW()
 */
export async function isProUser(userId: string): Promise<boolean> {
  const result = await sql`
    SELECT 1 FROM subscriptions
    WHERE user_id = ${userId}
      AND status = 'active'
      AND current_period_end > NOW()
    LIMIT 1
  `;
  return result.rows.length > 0;
}

/**
 * Get current usage for a user.
 * - For Pro users: count usage this month (date_trunc('month', NOW()))
 * - For Free users: count usage today (date_trunc('day', NOW()))
 */
export async function getUsage(userId: string): Promise<UsageLimits> {
  const isPro = await isProUser(userId);

  if (isPro) {
    // Pro users: monthly usage
    const result = await sql`
      SELECT
        COUNT(*) FILTER (WHERE usage_type = 'chat') as chat_count,
        COUNT(*) FILTER (WHERE usage_type = 'transcript') as transcript_count
      FROM usage
      WHERE user_id = ${userId}
        AND created_at >= date_trunc('month', NOW())
    `;

    const chatCount = parseInt(result.rows[0]?.chat_count || '0', 10);
    const transcriptCount = parseInt(result.rows[0]?.transcript_count || '0', 10);

    return {
      chats: { used: chatCount, limit: PRO_LIMITS.chatsPerMonth },
      transcripts: { used: transcriptCount, limit: PRO_LIMITS.transcriptsPerMonth },
    };
  } else {
    // Free users: daily usage
    const result = await sql`
      SELECT
        COUNT(*) FILTER (WHERE usage_type = 'chat') as chat_count,
        COUNT(*) FILTER (WHERE usage_type = 'transcript') as transcript_count
      FROM usage
      WHERE user_id = ${userId}
        AND created_at >= date_trunc('day', NOW())
    `;

    const chatCount = parseInt(result.rows[0]?.chat_count || '0', 10);
    const transcriptCount = parseInt(result.rows[0]?.transcript_count || '0', 10);

    return {
      chats: { used: chatCount, limit: FREE_LIMITS.chatsPerDay },
      transcripts: { used: transcriptCount, limit: FREE_LIMITS.transcriptsPerDay },
    };
  }
}

/**
 * Check if user can use a specific feature.
 * Returns true if used < limit for the type.
 */
export async function canUse(userId: string, type: UsageType): Promise<boolean> {
  const usage = await getUsage(userId);

  if (type === 'chat') {
    return usage.chats.used < usage.chats.limit;
  } else {
    return usage.transcripts.used < usage.transcripts.limit;
  }
}

/**
 * Log usage for a user.
 * Checks canUse first and returns false if not allowed.
 * Returns true if usage was logged successfully.
 */
export async function logUsage(userId: string, type: UsageType): Promise<boolean> {
  // Check if user can use this feature
  const allowed = await canUse(userId, type);
  if (!allowed) {
    return false;
  }

  // Log the usage
  await sql`
    INSERT INTO usage (user_id, usage_type, created_at)
    VALUES (${userId}, ${type}, NOW())
  `;

  return true;
}

/**
 * Get full plan information for a user.
 * Includes plan type, limits, and subscription info.
 */
export async function getUserPlan(userId: string): Promise<UserPlan> {
  const isPro = await isProUser(userId);
  const limits = await getUsage(userId);

  // Get subscription info if exists
  const subscriptionResult = await sql`
    SELECT status, current_period_end
    FROM subscriptions
    WHERE user_id = ${userId}
    LIMIT 1
  `;

  const subscription = subscriptionResult.rows[0]
    ? {
        status: subscriptionResult.rows[0].status as string,
        currentPeriodEnd: subscriptionResult.rows[0].current_period_end
          ? new Date(subscriptionResult.rows[0].current_period_end)
          : null,
      }
    : undefined;

  return {
    plan: isPro ? 'pro' : 'free',
    limits,
    subscription,
  };
}

/**
 * Activate a subscription for a user.
 * UPSERT into subscriptions with status='active'.
 */
export async function activateSubscription(
  userId: string,
  stripeSubscriptionId: string,
  stripeCustomerId: string,
  currentPeriodEnd: Date
): Promise<void> {
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
      ${currentPeriodEnd.toISOString()},
      NOW(),
      NOW()
    )
    ON CONFLICT (user_id)
    DO UPDATE SET
      stripe_subscription_id = ${stripeSubscriptionId},
      stripe_customer_id = ${stripeCustomerId},
      status = 'active',
      current_period_end = ${currentPeriodEnd.toISOString()},
      updated_at = NOW()
  `;
}

/**
 * Cancel a subscription for a user.
 * Sets status to 'canceled'.
 */
export async function cancelSubscription(userId: string): Promise<void> {
  await sql`
    UPDATE subscriptions
    SET status = 'canceled', updated_at = NOW()
    WHERE user_id = ${userId}
  `;
}

/**
 * Update subscription period end date.
 * Used when Stripe renews the subscription.
 */
export async function updateSubscriptionPeriod(
  stripeSubscriptionId: string,
  currentPeriodEnd: Date
): Promise<void> {
  await sql`
    UPDATE subscriptions
    SET current_period_end = ${currentPeriodEnd.toISOString()}, updated_at = NOW()
    WHERE stripe_subscription_id = ${stripeSubscriptionId}
  `;
}
