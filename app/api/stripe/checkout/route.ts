import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import Stripe from 'stripe';
import { getStripeSecretKey, getStripePricePro } from '@/lib/env';

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Sign in required' }, { status: 401 });
  }

  try {
    const stripe = new Stripe(getStripeSecretKey());
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: getStripePricePro(), quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://youtube-transcript-service-two.vercel.app'}/pricing?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://youtube-transcript-service-two.vercel.app'}/pricing?canceled=true`,
      metadata: { clerkUserId: userId },
      subscription_data: { metadata: { clerkUserId: userId } },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create checkout session' }, { status: 500 });
  }
}
