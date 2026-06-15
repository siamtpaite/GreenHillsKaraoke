import { NextResponse } from 'next/server';

// Slots collection no longer exists — timeline approach queries bookings directly.
export async function POST() {
  return NextResponse.json(
    { success: true, message: 'resync-slots is no longer needed — availability is derived from bookings collection.' },
    { status: 200 }
  );
}
