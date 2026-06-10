import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'GreenHills2021';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ date: string }> }) {
  try {
    const body = await req.json().catch(() => ({}));

    if (body.password !== ADMIN_PASSWORD) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { date } = await params;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ success: false, error: 'Invalid date format' }, { status: 400 });
    }

    await adminDb.doc(`blackoutDates/${date}`).delete();
    console.log(`[blackout-dates] Unblocked ${date}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[blackout-dates] DELETE error:', error);
    return NextResponse.json({ success: false, error: 'Failed to unblock date' }, { status: 500 });
  }
}
