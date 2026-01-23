import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { addCredits } from '@/lib/credits';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
});

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const { userId, credits } = session.metadata || {};

    if (userId && credits) {
      try {
        const newBalance = await addCredits(userId, parseInt(credits, 10));
        console.log(`Added ${credits} credits to user ${userId}. New balance: ${newBalance}`);
      } catch (error) {
        console.error('Failed to add credits:', error);
        // Don't return error - Stripe will retry
      }
    } else {
      console.error('Missing metadata in checkout session:', session.id);
    }
  }

  return NextResponse.json({ received: true });
}
