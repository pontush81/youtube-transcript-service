/**
 * Pricing tiers for TubeBase
 *
 * MVP: Only Free and Pro are fully implemented.
 * Starter and Team are defined for future use.
 */

export type PricingTier = 'free' | 'starter' | 'pro' | 'team';

export interface TierDefinition {
  name: string;
  priceMonthly: number; // in cents
  priceYearly: number; // in cents (17% discount)
  limits: {
    transcriptsPerDay?: number;
    transcriptsPerMonth?: number;
    chatsPerDay?: number;
    chatsPerMonth?: number;
  };
  features: string[];
  stripePriceIds?: {
    monthly?: string;
    yearly?: string;
  };
  badge?: string;
  available: boolean;
}

export const PRICING_TIERS: Record<PricingTier, TierDefinition> = {
  free: {
    name: 'Free',
    priceMonthly: 0,
    priceYearly: 0,
    limits: {
      transcriptsPerDay: 3,
      chatsPerDay: 3,
    },
    features: [
      '3 transcripts per day',
      '3 AI chats per day',
      'Save to knowledge base',
      'Basic search',
    ],
    available: true,
  },
  starter: {
    name: 'Starter',
    priceMonthly: 499, // $4.99
    priceYearly: 4990, // $49.90 (17% off)
    limits: {
      transcriptsPerMonth: 20,
      chatsPerMonth: 100,
    },
    features: [
      '20 transcripts per month',
      '100 AI chats per month',
      'Everything in Free',
      'Priority processing',
    ],
    stripePriceIds: {
      monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY,
      yearly: process.env.STRIPE_PRICE_STARTER_YEARLY,
    },
    available: false, // Coming soon
  },
  pro: {
    name: 'Pro',
    priceMonthly: 1499, // $14.99
    priceYearly: 14990, // $149.90
    limits: {
      transcriptsPerMonth: 100,
      chatsPerMonth: -1, // unlimited
    },
    features: [
      '100 transcripts per month',
      'Unlimited AI chats',
      'Everything in Starter',
      'Priority support',
      'Export to Markdown',
    ],
    stripePriceIds: {
      monthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
      yearly: process.env.STRIPE_PRICE_PRO_YEARLY,
    },
    badge: 'Most Popular',
    available: true,
  },
  team: {
    name: 'Team',
    priceMonthly: 3499, // $34.99
    priceYearly: 34990, // $349.90
    limits: {
      transcriptsPerMonth: -1, // unlimited
      chatsPerMonth: -1, // unlimited
    },
    features: [
      'Unlimited transcripts',
      'Unlimited AI chats',
      'Everything in Pro',
      'API access',
      'Team collaboration',
    ],
    stripePriceIds: {
      monthly: process.env.STRIPE_PRICE_TEAM_MONTHLY,
      yearly: process.env.STRIPE_PRICE_TEAM_YEARLY,
    },
    available: false, // Coming soon
  },
} as const;

/**
 * Format price for display
 */
export function formatPrice(cents: number): string {
  if (cents === 0) return '$0';
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Get the Stripe price ID for a tier and billing period
 */
export function getStripePriceId(tier: PricingTier, period: 'monthly' | 'yearly'): string | undefined {
  return PRICING_TIERS[tier].stripePriceIds?.[period];
}

/**
 * Check if a tier is paid (requires subscription)
 */
export function isPaidTier(tier: PricingTier): boolean {
  return tier !== 'free';
}
