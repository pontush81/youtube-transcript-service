import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { addCredits, getCredits } from '@/lib/credits';
import { z } from 'zod';

const addCreditsSchema = z.object({
  userId: z.string().min(1, 'userId krävs'),
  amount: z.number().int().positive('amount måste vara ett positivt heltal'),
});

// POST /api/admin/credits - Add credits to a user
export async function POST(request: NextRequest) {
  const { authorized } = await requireAdmin(request);

  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = addCreditsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Ogiltig förfrågan' },
        { status: 400 }
      );
    }

    const { userId, amount } = parsed.data;
    const newBalance = await addCredits(userId, amount);

    return NextResponse.json({
      success: true,
      userId,
      added: amount,
      newBalance,
    });
  } catch (error) {
    console.error('Add credits error:', error);
    return NextResponse.json(
      { error: 'Kunde inte lägga till credits' },
      { status: 500 }
    );
  }
}

// GET /api/admin/credits?userId=xxx - Get user's credit balance
export async function GET(request: NextRequest) {
  const { authorized } = await requireAdmin(request);

  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = request.nextUrl.searchParams.get('userId');

  if (!userId) {
    return NextResponse.json(
      { error: 'userId parameter krävs' },
      { status: 400 }
    );
  }

  try {
    const balance = await getCredits(userId);
    return NextResponse.json({ userId, balance });
  } catch (error) {
    console.error('Get credits error:', error);
    return NextResponse.json(
      { error: 'Kunde inte hämta credits' },
      { status: 500 }
    );
  }
}
