import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import GitHub from 'next-auth/providers/github';
import type { Adapter, AdapterUser, AdapterAccount, AdapterSession, VerificationToken } from 'next-auth/adapters';
import { sql } from '@/lib/db';

// Custom PostgreSQL adapter for NextAuth v5
// Based on the official pg-adapter but simplified for our use case
const PostgresAdapter: Adapter = {
  async createUser(user: Omit<AdapterUser, 'id'>): Promise<AdapterUser> {
    const emailVerified = user.emailVerified ? user.emailVerified.toISOString() : null;
    const result = await sql`
      INSERT INTO users (email, name, image, email_verified)
      VALUES (${user.email}, ${user.name || null}, ${user.image || null}, ${emailVerified})
      RETURNING id, email, name, image, email_verified as "emailVerified"
    `;
    return result.rows[0] as AdapterUser;
  },

  async getUser(id: string): Promise<AdapterUser | null> {
    const result = await sql`
      SELECT id, email, name, image, email_verified as "emailVerified"
      FROM users WHERE id = ${id}
    `;
    return result.rows[0] as AdapterUser || null;
  },

  async getUserByEmail(email: string): Promise<AdapterUser | null> {
    const result = await sql`
      SELECT id, email, name, image, email_verified as "emailVerified"
      FROM users WHERE email = ${email}
    `;
    return result.rows[0] as AdapterUser || null;
  },

  async getUserByAccount({ provider, providerAccountId }: Pick<AdapterAccount, 'provider' | 'providerAccountId'>): Promise<AdapterUser | null> {
    const result = await sql`
      SELECT u.id, u.email, u.name, u.image, u.email_verified as "emailVerified"
      FROM users u
      JOIN accounts a ON u.id = a.user_id
      WHERE a.provider = ${provider} AND a.provider_account_id = ${providerAccountId}
    `;
    return result.rows[0] as AdapterUser || null;
  },

  async updateUser(user: Partial<AdapterUser> & Pick<AdapterUser, 'id'>): Promise<AdapterUser> {
    const emailVerified = user.emailVerified ? user.emailVerified.toISOString() : null;
    const result = await sql`
      UPDATE users SET
        email = COALESCE(${user.email || null}, email),
        name = COALESCE(${user.name || null}, name),
        image = COALESCE(${user.image || null}, image),
        email_verified = COALESCE(${emailVerified}, email_verified),
        updated_at = NOW()
      WHERE id = ${user.id}
      RETURNING id, email, name, image, email_verified as "emailVerified"
    `;
    return result.rows[0] as AdapterUser;
  },

  async linkAccount(account: AdapterAccount): Promise<AdapterAccount | null | undefined> {
    // Convert session_state to string if it's not already
    const sessionState = account.session_state
      ? typeof account.session_state === 'string'
        ? account.session_state
        : JSON.stringify(account.session_state)
      : null;
    await sql`
      INSERT INTO accounts (user_id, type, provider, provider_account_id, refresh_token, access_token, expires_at, token_type, scope, id_token, session_state)
      VALUES (${account.userId}, ${account.type}, ${account.provider}, ${account.providerAccountId}, ${account.refresh_token || null}, ${account.access_token || null}, ${account.expires_at || null}, ${account.token_type || null}, ${account.scope || null}, ${account.id_token || null}, ${sessionState})
    `;
    return account;
  },

  async createSession(session: { sessionToken: string; userId: string; expires: Date }): Promise<AdapterSession> {
    const expires = session.expires.toISOString();
    await sql`
      INSERT INTO sessions (session_token, user_id, expires)
      VALUES (${session.sessionToken}, ${session.userId}, ${expires})
    `;
    return session;
  },

  async getSessionAndUser(sessionToken: string): Promise<{ session: AdapterSession; user: AdapterUser } | null> {
    const result = await sql`
      SELECT
        s.session_token as "sessionToken", s.user_id as "userId", s.expires,
        u.id, u.email, u.name, u.image, u.email_verified as "emailVerified"
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.session_token = ${sessionToken}
    `;
    if (!result.rows[0]) return null;
    const row = result.rows[0];
    return {
      session: { sessionToken: row.sessionToken as string, userId: row.userId as string, expires: row.expires as Date },
      user: { id: row.id as string, email: row.email as string, name: row.name as string | null, image: row.image as string | null, emailVerified: row.emailVerified as Date | null },
    };
  },

  async updateSession(session: Partial<AdapterSession> & Pick<AdapterSession, 'sessionToken'>): Promise<AdapterSession | null | undefined> {
    const expires = session.expires ? session.expires.toISOString() : null;
    const result = await sql`
      UPDATE sessions SET expires = ${expires}
      WHERE session_token = ${session.sessionToken}
      RETURNING session_token as "sessionToken", user_id as "userId", expires
    `;
    return result.rows[0] as AdapterSession || null;
  },

  async deleteSession(sessionToken: string): Promise<AdapterSession | null | undefined> {
    await sql`DELETE FROM sessions WHERE session_token = ${sessionToken}`;
    return null;
  },

  async createVerificationToken(token: VerificationToken): Promise<VerificationToken | null | undefined> {
    const expires = token.expires.toISOString();
    await sql`
      INSERT INTO verification_tokens (identifier, token, expires)
      VALUES (${token.identifier}, ${token.token}, ${expires})
    `;
    return token;
  },

  async useVerificationToken({ identifier, token }: { identifier: string; token: string }): Promise<VerificationToken | null> {
    const result = await sql`
      DELETE FROM verification_tokens
      WHERE identifier = ${identifier} AND token = ${token}
      RETURNING identifier, token, expires
    `;
    return result.rows[0] as VerificationToken || null;
  },
};

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PostgresAdapter,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async session({ session, user }) {
      // Add user ID to session
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
  session: {
    strategy: 'database',
  },
});

// Type augmentation for session
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
    };
  }
}
