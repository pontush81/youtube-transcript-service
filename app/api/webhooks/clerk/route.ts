import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server';
import { sql } from '@vercel/postgres';

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    throw new Error('Please add CLERK_WEBHOOK_SECRET to environment variables');
  }

  // Get headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Missing svix headers', { status: 400 });
  }

  // Get body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Verify webhook
  const wh = new Webhook(WEBHOOK_SECRET);
  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error('Webhook verification failed:', err);
    return new Response('Webhook verification failed', { status: 400 });
  }

  // Handle events
  const eventType = evt.type;

  if (eventType === 'user.created' || eventType === 'user.updated') {
    const { id, email_addresses, first_name, last_name, image_url } = evt.data;

    const email = email_addresses?.[0]?.email_address;
    const name = [first_name, last_name].filter(Boolean).join(' ') || null;

    await sql`
      INSERT INTO users (id, email, name, image, updated_at)
      VALUES (${id}, ${email}, ${name}, ${image_url}, NOW())
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        name = EXCLUDED.name,
        image = EXCLUDED.image,
        updated_at = NOW()
    `;
  }

  if (eventType === 'user.deleted') {
    const { id } = evt.data;

    // Soft delete - keep user data but clear PII
    await sql`
      UPDATE users SET
        email = NULL,
        name = 'Deleted User',
        updated_at = NOW()
      WHERE id = ${id}
    `;
  }

  return new Response('Webhook processed', { status: 200 });
}
