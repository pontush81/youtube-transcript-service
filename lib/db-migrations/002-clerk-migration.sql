-- Clerk Migration Script
-- Clerk uses string IDs (user_xxx format), not UUIDs
-- Run this migration manually when ready to switch

-- IMPORTANT: This migration will break existing user-transcript relationships
-- since Clerk user IDs are different from NextAuth UUIDs.
-- Users will need to re-authenticate after migration.

-- Step 1: Backup existing data (run manually first)
-- CREATE TABLE users_backup AS SELECT * FROM users;
-- CREATE TABLE user_transcripts_backup AS SELECT * FROM user_transcripts;

-- Step 2: Alter users table for Clerk IDs
-- Change id column from UUID to TEXT to accommodate Clerk's user_xxx format
ALTER TABLE users
  ALTER COLUMN id TYPE TEXT;

-- Step 3: Alter user_transcripts to match new ID format
ALTER TABLE user_transcripts
  ALTER COLUMN user_id TYPE TEXT;

-- Step 4: Drop old NextAuth-specific tables (optional, run after confirming migration works)
-- These tables are no longer needed with Clerk:
-- DROP TABLE IF EXISTS accounts;
-- DROP TABLE IF EXISTS sessions;
-- DROP TABLE IF EXISTS verification_tokens;

-- Step 5: Clean up old users if starting fresh (optional)
-- TRUNCATE TABLE users CASCADE;

-- Note: After running this migration:
-- 1. Deploy the new code with Clerk
-- 2. Existing users will need to sign up again
-- 3. Their old transcripts will be orphaned (user_id won't match)
-- 4. Consider a data migration strategy if preserving user data is critical
