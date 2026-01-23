import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { setupDatabase } from '@/lib/db-schema';

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
  const adminKey = request.headers.get('x-admin-key');
  const validKey = process.env.ADMIN_KEY;

  if (!adminKey || !validKey || !secureCompare(adminKey, validKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await setupDatabase();
    return NextResponse.json({ success: true, message: 'Database setup complete' });
  } catch (error) {
    console.error('Database setup error:', error);
    return NextResponse.json(
      { success: false, error: 'Database setup failed' },
      { status: 500 }
    );
  }
}
