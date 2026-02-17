import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { clerkClient } from '@clerk/nextjs/server';
import { getStripeSecretKey } from '@/lib/env';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature');

  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  const stripe = new Stripe(getStripeSecretKey());

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const client = await clerkClient();

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      const clerkUserId = subscription.metadata.clerkUserId;
      if (clerkUserId && subscription.status === 'active') {
        await client.users.updateUserMetadata(clerkUserId, {
          publicMetadata: { plan: 'pro' },
        });
      }
      if (clerkUserId && ['canceled', 'unpaid', 'past_due'].includes(subscription.status)) {
        await client.users.updateUserMetadata(clerkUserId, {
          publicMetadata: { plan: 'free' },
        });
      }
      break;
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const clerkUserId = subscription.metadata.clerkUserId;
      if (clerkUserId) {
        await client.users.updateUserMetadata(clerkUserId, {
          publicMetadata: { plan: 'free' },
        });
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
