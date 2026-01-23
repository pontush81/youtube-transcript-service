import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getCredits, initializeCredits } from '@/lib/credits';

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Initialize credits if new user, otherwise get existing
    const balance = await initializeCredits(userId);

    return NextResponse.json({ balance });
  } catch (error) {
    console.error('Credits fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch credits' },
      { status: 500 }
    );
  }
}
