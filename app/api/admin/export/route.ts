import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import PDFDocument from 'pdfkit';

function minutesToTime(min: number): string {
  if (min >= 1440) return '12:00 AM';
  const h = Math.floor(min / 60), m = min % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  const dh = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${dh}:${m.toString().padStart(2, '0')} ${period}`;
}

function resolveStartTime(data: any): number {
  return data.startTime ?? data.startMinute ?? (data.startHour != null ? data.startHour * 60 : 720);
}

function resolveDuration(data: any): number {
  return data.duration ?? (data.hours != null ? data.hours * 60 : 60);
}

function csvEscape(val: string | number | null | undefined): string {
  const s = val == null ? '' : String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * GET /api/admin/export
 * Query params: startDate (YYYY-MM-DD), endDate (YYYY-MM-DD), format (csv|pdf)
 */
export async function GET(request: NextRequest) {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw || request.headers.get('x-admin-password') !== pw) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate   = searchParams.get('endDate');
  const format    = searchParams.get('format') ?? 'csv';

  if (!startDate || !endDate) {
    return NextResponse.json({ success: false, error: 'startDate and endDate are required (YYYY-MM-DD)' }, { status: 400 });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return NextResponse.json({ success: false, error: 'Dates must be YYYY-MM-DD' }, { status: 400 });
  }

  if (format !== 'csv' && format !== 'pdf') {
    return NextResponse.json({ success: false, error: 'format must be csv or pdf' }, { status: 400 });
  }

  const snap = await adminDb.collection('bookings')
    .where('date', '>=', startDate)
    .where('date', '<=', endDate)
    .orderBy('date', 'asc')
    .get();

  const bookings = snap.docs.map(doc => {
    const d = doc.data();
    const startTime = resolveStartTime(d);
    const dur = resolveDuration(d);
    const cancelledAt = d.cancelledAt
      ? (d.cancelledAt.toDate ? d.cancelledAt.toDate().toISOString() : String(d.cancelledAt))
      : '';
    const createdAt = d.createdAt
      ? (d.createdAt.toDate ? d.createdAt.toDate().toISOString() : String(d.createdAt))
      : '';
    return {
      id: doc.id,
      customerName:    d.customerName ?? '',
      customerPhone:   d.customerPhone ?? '',
      customerEmail:   d.customerEmail ?? '',
      date:            d.date ?? '',
      startTimeMin:    startTime,
      durationMin:     dur,
      paymentType:     d.paymentType ?? '',
      totalAmount:     d.totalAmount ?? 0,
      paidAmount:      d.paidAmount ?? d.depositPaid ?? 0,
      balanceDue:      d.balanceDue ?? d.amountDue ?? 0,
      status:          d.status ?? '',
      specialRequests: d.specialRequests ?? d.notes ?? '',
      createdAt,
      cancelledAt,
    };
  });

  const filename = `GreenHills-Karaoke-Export-${startDate}-to-${endDate}`;

  // ─── CSV ────────────────────────────────────────────────────────────────────
  if (format === 'csv') {
    const headers = [
      'Booking ID', 'Guest Name', 'Phone', 'Email', 'Date',
      'Start Time', 'Duration (hrs)', 'Payment Type',
      'Total Amount (Rs)', 'Paid Amount (Rs)', 'Balance Due (Rs)',
      'Status', 'Special Requests', 'Booking Created At', 'Cancelled At',
    ];

    const rows = bookings.map(b => [
      b.id,
      b.customerName,
      b.customerPhone,
      b.customerEmail,
      b.date,
      minutesToTime(b.startTimeMin),
      (b.durationMin / 60).toFixed(1),
      b.paymentType,
      b.totalAmount,
      b.paidAmount,
      b.balanceDue,
      b.status,
      b.specialRequests,
      b.createdAt,
      b.cancelledAt,
    ].map(csvEscape).join(','));

    const csv = [headers.map(csvEscape).join(','), ...rows].join('\n');

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}.csv"`,
      },
    });
  }

  // ─── PDF ────────────────────────────────────────────────────────────────────
  const totalBookings = bookings.length;
  const statusCounts = { confirmed: 0, checked_in: 0, completed: 0, cancelled: 0, no_show: 0 };
  let totalRevenue = 0, totalOutstanding = 0;

  for (const b of bookings) {
    const s = b.status as keyof typeof statusCounts;
    if (s in statusCounts) statusCounts[s]++;
    totalRevenue += b.paidAmount;
    if (b.status === 'confirmed' || b.status === 'checked_in') totalOutstanding += b.balanceDue;
  }

  const noShowRate = totalBookings > 0
    ? ((statusCounts.no_show / totalBookings) * 100).toFixed(1)
    : '0.0';

  const generatedAt = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));

  await new Promise<void>((resolve) => {
    doc.on('end', resolve);

    // Header
    doc.fontSize(18).font('Helvetica-Bold')
       .text('GreenHills Karaoke — Booking Export', { align: 'center' });
    doc.fontSize(11).font('Helvetica')
       .text(`Date Range: ${startDate} to ${endDate}`, { align: 'center' });
    doc.text(`Generated: ${generatedAt} IST`, { align: 'center' });
    doc.moveDown();

    // Summary block
    doc.fontSize(12).font('Helvetica-Bold').text('Summary');
    doc.fontSize(10).font('Helvetica');
    doc.text(`Total Bookings: ${totalBookings}`);
    doc.text(`Confirmed: ${statusCounts.confirmed}  |  Checked In: ${statusCounts.checked_in}  |  Completed: ${statusCounts.completed}  |  Cancelled: ${statusCounts.cancelled}  |  No Show: ${statusCounts.no_show}`);
    doc.text(`Total Revenue Collected: Rs ${totalRevenue.toLocaleString('en-IN')}`);
    doc.text(`Total Outstanding Balance: Rs ${totalOutstanding.toLocaleString('en-IN')}`);
    doc.text(`Total Cancellations: ${statusCounts.cancelled}`);
    doc.text(`No-Show Rate: ${noShowRate}%`);
    doc.moveDown();

    // Table
    const cols = [
      { label: 'Booking ID',       width: 115 },
      { label: 'Guest Name',        width: 90 },
      { label: 'Phone',             width: 70 },
      { label: 'Date',              width: 60 },
      { label: 'Start Time',        width: 55 },
      { label: 'Dur (hrs)',         width: 45 },
      { label: 'Payment',           width: 50 },
      { label: 'Total (Rs)',        width: 52 },
      { label: 'Paid (Rs)',         width: 52 },
      { label: 'Due (Rs)',          width: 48 },
      { label: 'Status',            width: 60 },
      { label: 'Special Requests',  width: 110 },
    ];

    const tableX = 40;
    let y = doc.y;
    const rowH = 16;

    // Header row
    doc.fontSize(8).font('Helvetica-Bold');
    doc.rect(tableX, y, cols.reduce((s, c) => s + c.width, 0), rowH).fill('#334155');
    doc.fillColor('white');
    let cx = tableX;
    for (const col of cols) {
      doc.text(col.label, cx + 2, y + 4, { width: col.width - 4, lineBreak: false });
      cx += col.width;
    }
    y += rowH;

    doc.font('Helvetica').fontSize(7).fillColor('black');
    for (let i = 0; i < bookings.length; i++) {
      const b = bookings[i];
      if (y + rowH > doc.page.height - 40) {
        doc.addPage();
        y = 40;
      }
      if (i % 2 === 0) {
        doc.rect(tableX, y, cols.reduce((s, c) => s + c.width, 0), rowH).fill('#f1f5f9');
      }
      doc.fillColor('black');
      const cells = [
        b.id.slice(0, 20),
        b.customerName,
        b.customerPhone,
        b.date,
        minutesToTime(b.startTimeMin),
        (b.durationMin / 60).toFixed(1),
        b.paymentType,
        String(b.totalAmount),
        String(b.paidAmount),
        String(b.balanceDue),
        b.status,
        (b.specialRequests || '').slice(0, 40),
      ];
      cx = tableX;
      for (let j = 0; j < cols.length; j++) {
        doc.text(cells[j], cx + 2, y + 4, { width: cols[j].width - 4, lineBreak: false });
        cx += cols[j].width;
      }
      y += rowH;
    }

    doc.end();
  });

  const pdfBuffer = Buffer.concat(chunks);
  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}.pdf"`,
    },
  });
}
