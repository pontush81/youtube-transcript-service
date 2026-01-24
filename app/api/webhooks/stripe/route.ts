import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { addCredits } from '@/lib/credits';
import { activateSubscription, cancelSubscription, updateSubscriptionPeriod } from '@/lib/usage';

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

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  const stripe = getStripe();

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

  // Log the event type for debugging
  console.log('Stripe webhook event:', event.type);

  // Handle checkout.session.completed for one-time payments (legacy credits)
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;

    // Only process one-time payments (not subscriptions)
    if (session.mode === 'payment') {
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
  }

  // Handle subscription created/updated
  if (event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.updated') {
    const subscription = event.data.object as Stripe.Subscription;
    const userId = subscription.metadata.userId;

    if (userId && subscription.status === 'active') {
      try {
        // In newer Stripe API versions, current_period_end is on the items
        const firstItem = subscription.items.data[0];
        const periodEnd = firstItem?.current_period_end;

        if (periodEnd) {
          await activateSubscription(
            userId,
            subscription.id,
            subscription.customer as string,
            new Date(periodEnd * 1000)
          );
          console.log(`Activated subscription for user ${userId}`);
        } else {
          console.error('No period end found on subscription items');
        }
      } catch (error) {
        console.error('Failed to activate subscription:', error);
      }
    }
  }

  // Handle subscription canceled or expired
  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription;
    const userId = subscription.metadata.userId;

    if (userId) {
      try {
        await cancelSubscription(userId);
        console.log(`Canceled subscription for user ${userId}`);
      } catch (error) {
        console.error('Failed to cancel subscription:', error);
      }
    }
  }

  // Handle invoice paid (subscription renewal)
  if (event.type === 'invoice.paid') {
    const invoice = event.data.object as Stripe.Invoice;
    // Access subscription from invoice parent object
    const subscriptionId = (invoice as { subscription?: string | null }).subscription;

    if (subscriptionId) {
      try {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        // In newer Stripe API versions, current_period_end is on the items
        const firstItem = subscription.items.data[0];
        const periodEnd = firstItem?.current_period_end;

        if (periodEnd) {
          await updateSubscriptionPeriod(
            subscription.id,
            new Date(periodEnd * 1000)
          );
          console.log(`Updated subscription period for ${subscription.id}`);
        }
      } catch (error) {
        console.error('Failed to update subscription period:', error);
      }
    }
  }

  return NextResponse.json({ received: true });
}
