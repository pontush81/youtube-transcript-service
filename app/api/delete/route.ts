import { NextRequest, NextResponse } from 'next/server';
import { del } from '@vercel/blob';

export async function POST(request: NextRequest) {
  try {
    const { blobUrl, adminKey } = await request.json();

    // Enkel admin-kontroll
    const validAdminKey = process.env.ADMIN_KEY;
    if (!validAdminKey || adminKey !== validAdminKey) {
      return NextResponse.json(
        { success: false, error: 'Ogiltig admin-nyckel' },
        { status: 401 }
      );
    }

    if (!blobUrl) {
      return NextResponse.json(
        { success: false, error: 'Blob URL krävs' },
        { status: 400 }
      );
    }

    // Radera från Vercel Blob
    await del(blobUrl);

    return NextResponse.json({
      success: true,
      message: 'Transkriptet har raderats',
    });
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json(
      { success: false, error: 'Kunde inte radera transkriptet' },
      { status: 500 }
    );
  }
}
