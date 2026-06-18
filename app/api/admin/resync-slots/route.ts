import { NextRequest, NextResponse } from 'next/server';

// Slots collection no longer exists — timeline approach queries bookings directly.
export async function POST(req: NextRequest) {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw || req.headers.get('x-admin-password') !== pw) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json(
    { success: true, message: 'resync-slots is no longer needed — availability is derived from bookings collection.' },
    { status: 200 }
  );
}
