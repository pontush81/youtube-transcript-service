import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import Stripe from 'stripe';
import { z } from 'zod';

// Lazy initialization to prevent build errors when env vars are missing
function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  return new Stripe(key, {
    apiVersion: '2025-12-15.clover',
  });
}

const CREDIT_PACKAGES: Record<string, { priceId: string; credits: number; name: string }> = {
  starter: {
    priceId: process.env.STRIPE_PRICE_STARTER!,
    credits: 100,
    name: 'Starter (100 credits)'
  },
  pro: {
    priceId: process.env.STRIPE_PRICE_PRO!,
    credits: 500,
    name: 'Pro (500 credits)'
  },
  mega: {
    priceId: process.env.STRIPE_PRICE_MEGA!,
    credits: 2000,
    name: 'Mega (2000 credits)'
  },
};

const checkoutSchema = z.object({
  package: z.enum(['starter', 'pro', 'mega']),
});

export async function POST(request: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = checkoutSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Ogiltigt paket' }, { status: 400 });
    }

    const creditPackage = CREDIT_PACKAGES[parsed.data.package];

    if (!creditPackage || !creditPackage.priceId) {
      return NextResponse.json(
        { error: 'Paketet är inte konfigurerat' },
        { status: 500 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price: creditPackage.priceId,
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/credits?success=true`,
      cancel_url: `${baseUrl}/credits?canceled=true`,
      metadata: {
        userId,
        credits: creditPackage.credits.toString(),
        package: parsed.data.package,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json(
      { error: 'Kunde inte skapa checkout-session' },
      { status: 500 }
    );
  }
}
