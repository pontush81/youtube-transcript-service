import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function POST(request: NextRequest) {
  // Require admin key for security
  const adminKey = request.headers.get('x-admin-key');
  if (adminKey !== process.env.ADMIN_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: string[] = [];

  try {
    // Check current schema
    const usersCol = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'id'
    `;
    results.push(`Current users.id type: ${usersCol.rows[0]?.data_type || 'not found'}`);

    const userTranscriptsCol = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'user_transcripts' AND column_name = 'user_id'
    `;
    results.push(`Current user_transcripts.user_id type: ${userTranscriptsCol.rows[0]?.data_type || 'not found'}`);

    // Only migrate if needed
    if (usersCol.rows[0]?.data_type === 'uuid') {
      // Step 1: Drop foreign key constraint if exists
      try {
        await sql`
          ALTER TABLE user_transcripts
          DROP CONSTRAINT IF EXISTS user_transcripts_user_id_fkey
        `;
        results.push('Dropped foreign key constraint');
      } catch (e) {
        results.push(`Foreign key drop skipped: ${e}`);
      }

      // Step 2: Alter users.id to TEXT
      await sql`ALTER TABLE users ALTER COLUMN id TYPE TEXT`;
      results.push('Altered users.id to TEXT');

      // Step 3: Alter user_transcripts.user_id to TEXT
      await sql`ALTER TABLE user_transcripts ALTER COLUMN user_id TYPE TEXT`;
      results.push('Altered user_transcripts.user_id to TEXT');

      // Step 4: Re-add foreign key (optional, Clerk IDs won't match old UUIDs anyway)
      // Skipping this since old user data won't match Clerk IDs

      results.push('Migration completed successfully!');
    } else if (usersCol.rows[0]?.data_type === 'text') {
      results.push('Already migrated to TEXT - no action needed');
    } else {
      results.push('Users table not found or unexpected schema');
    }

    // Drop old NextAuth tables
    const dropOld = request.nextUrl.searchParams.get('dropOld') === 'true';
    if (dropOld) {
      await sql`DROP TABLE IF EXISTS accounts`;
      await sql`DROP TABLE IF EXISTS sessions`;
      await sql`DROP TABLE IF EXISTS verification_tokens`;
      results.push('Dropped old NextAuth tables (accounts, sessions, verification_tokens)');
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json({
      success: false,
      error: String(error),
      results
    }, { status: 500 });
  }
}
