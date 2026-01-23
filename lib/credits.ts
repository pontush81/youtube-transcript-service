import { sql } from '@/lib/db';

const DEFAULT_CREDITS = 20;

/**
 * Get current credit balance for a user.
 * Returns 0 if user has no credits record.
 */
export async function getCredits(userId: string): Promise<number> {
  const result = await sql`
    SELECT balance FROM user_credits WHERE user_id = ${userId}
  `;
  return result.rows[0]?.balance ?? 0;
}

/**
 * Use one credit for a chat query.
 * Returns true if credit was deducted, false if no credits available.
 * Uses atomic UPDATE to prevent race conditions.
 */
export async function useCredit(userId: string): Promise<boolean> {
  const result = await sql`
    UPDATE user_credits
    SET balance = balance - 1, updated_at = NOW()
    WHERE user_id = ${userId} AND balance > 0
    RETURNING balance
  `;
  return result.rows.length > 0;
}

/**
 * Add credits to a user's balance.
 * Creates the user record if it doesn't exist.
 */
export async function addCredits(userId: string, amount: number): Promise<number> {
  const result = await sql`
    INSERT INTO user_credits (user_id, balance, updated_at)
    VALUES (${userId}, ${amount}, NOW())
    ON CONFLICT (user_id)
    DO UPDATE SET
      balance = user_credits.balance + ${amount},
      updated_at = NOW()
    RETURNING balance
  `;
  return result.rows[0]?.balance ?? amount;
}

/**
 * Initialize credits for a new user.
 * Only creates record if one doesn't exist.
 */
export async function initializeCredits(userId: string): Promise<number> {
  const result = await sql`
    INSERT INTO user_credits (user_id, balance, updated_at)
    VALUES (${userId}, ${DEFAULT_CREDITS}, NOW())
    ON CONFLICT (user_id) DO NOTHING
    RETURNING balance
  `;

  // If insert happened, return the new balance
  if (result.rows.length > 0) {
    return result.rows[0].balance;
  }

  // Otherwise, get existing balance
  return getCredits(userId);
}

/**
 * Check if user has credits without consuming any.
 */
export async function hasCredits(userId: string): Promise<boolean> {
  const balance = await getCredits(userId);
  return balance > 0;
}
