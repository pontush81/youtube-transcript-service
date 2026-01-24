import { NextRequest, NextResponse } from 'next/server';
import { hasValidAdminKey } from '@/lib/admin';
import { sql } from '@/lib/db';

export async function POST(request: NextRequest) {
  if (!hasValidAdminKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Create usage table for tracking feature usage (chat messages, content adds, etc.)
    await sql`
      CREATE TABLE IF NOT EXISTS usage (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        usage_type TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Create index for efficient queries by user and date
    await sql`
      CREATE INDEX IF NOT EXISTS idx_usage_user_date
      ON usage (user_id, created_at)
    `;

    // Create subscriptions table for Stripe subscription management
    await sql`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id SERIAL PRIMARY KEY,
        user_id TEXT UNIQUE NOT NULL,
        stripe_subscription_id TEXT,
        stripe_customer_id TEXT,
        status TEXT NOT NULL DEFAULT 'inactive',
        current_period_end TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;

    return NextResponse.json({
      success: true,
      message: 'Usage and subscriptions tables created successfully',
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Migration failed' },
      { status: 500 }
    );
  }
}
