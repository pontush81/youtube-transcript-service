import { NextRequest, NextResponse } from 'next/server';
import { hasValidAdminKey } from '@/lib/admin';
import { setupDatabase } from '@/lib/db-schema';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  if (!hasValidAdminKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await setupDatabase();
    return NextResponse.json({ success: true, message: 'Database setup complete' });
  } catch (error) {
    logger.error('Database setup error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { success: false, error: 'Database setup failed' },
      { status: 500 }
    );
  }
}
