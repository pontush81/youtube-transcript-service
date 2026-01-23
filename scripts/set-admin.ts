/**
 * Script to set a user as admin
 * Usage: npx tsx scripts/set-admin.ts <user-email>
 *
 * Requires CLERK_SECRET_KEY environment variable
 */

import { createClerkClient } from '@clerk/backend';

async function main() {
  const email = process.argv[2];

  if (!email) {
    console.error('Usage: npx tsx scripts/set-admin.ts <user-email>');
    process.exit(1);
  }

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    console.error('CLERK_SECRET_KEY environment variable required');
    process.exit(1);
  }

  const clerk = createClerkClient({ secretKey });

  // Find user by email
  const users = await clerk.users.getUserList({
    emailAddress: [email],
  });

  if (users.data.length === 0) {
    console.error(`No user found with email: ${email}`);
    process.exit(1);
  }

  const user = users.data[0];
  console.log(`Found user: ${user.id} (${user.emailAddresses[0]?.emailAddress})`);

  // Set admin role
  await clerk.users.updateUserMetadata(user.id, {
    publicMetadata: { role: 'admin' },
  });

  console.log(`Successfully set ${email} as admin!`);
}

main().catch(console.error);
