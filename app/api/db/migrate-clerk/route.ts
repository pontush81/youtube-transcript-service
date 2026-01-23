import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { sql } from '@/lib/db';

function secureCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) {
    timingSafeEqual(aBuffer, aBuffer);
    return false;
  }
  return timingSafeEqual(aBuffer, bBuffer);
}

export async function POST(request: NextRequest) {
  // Require admin key for security
  const adminKey = request.headers.get('x-admin-key');
  const validKey = process.env.ADMIN_KEY;

  if (!adminKey || !validKey || !secureCompare(adminKey, validKey)) {
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

    // Step 1: Drop ALL NextAuth tables first (they have foreign keys to users)
    await sql`DROP TABLE IF EXISTS accounts CASCADE`;
    await sql`DROP TABLE IF EXISTS sessions CASCADE`;
    await sql`DROP TABLE IF EXISTS verification_tokens CASCADE`;
    results.push('Dropped NextAuth tables (accounts, sessions, verification_tokens)');

    // Only migrate if needed
    if (usersCol.rows[0]?.data_type === 'uuid') {
      // Step 2: Drop foreign key constraint on user_transcripts if exists
      try {
        await sql`
          ALTER TABLE user_transcripts
          DROP CONSTRAINT IF EXISTS user_transcripts_user_id_fkey
        `;
        results.push('Dropped user_transcripts foreign key constraint');
      } catch (e) {
        results.push(`Foreign key drop note: ${e}`);
      }

      // Step 3: Alter users.id to TEXT
      await sql`ALTER TABLE users ALTER COLUMN id TYPE TEXT USING id::TEXT`;
      results.push('Altered users.id to TEXT');

      // Step 4: Alter user_transcripts.user_id to TEXT
      await sql`ALTER TABLE user_transcripts ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT`;
      results.push('Altered user_transcripts.user_id to TEXT');

      results.push('Migration completed successfully!');
    } else if (usersCol.rows[0]?.data_type === 'text') {
      results.push('Already migrated to TEXT - no action needed');
    } else {
      results.push('Users table not found - will be created on first Clerk webhook');
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
