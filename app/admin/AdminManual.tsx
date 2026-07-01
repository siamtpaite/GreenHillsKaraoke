'use client';

interface Props {
  open: boolean;
  onClose: () => void;
}

// Start Time Chart: every 5 minutes from 10:00 AM (600) to 12:00 AM midnight (1440)
function buildTimeChart() {
  const entries: { time: string; code: number }[] = [];
  for (let code = 600; code <= 1440; code += 5) {
    const totalMinutes = code;
    const h24 = Math.floor(totalMinutes / 60) % 24;
    const min = totalMinutes % 60;
    const ampm = h24 >= 12 ? 'PM' : 'AM';
    const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
    const label =
      code === 1440
        ? '12:00 AM (midnight)'
        : `${h12}:${min.toString().padStart(2, '0')} ${ampm}`;
    entries.push({ time: label, code });
  }
  return entries;
}

const TIME_CHART = buildTimeChart();

// Group into 4 columns for display
const CHART_COLS: { time: string; code: number }[][] = [[], [], [], []];
TIME_CHART.forEach((e, i) => {
  CHART_COLS[i % 4].push(e);
});

export default function AdminManual({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/98 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-w-4xl mx-auto px-4 py-8 pb-20">

        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-8 sticky top-0 bg-slate-950/95 backdrop-blur-sm py-4 -mx-4 px-4 border-b border-slate-800/50 z-10">
          <div>
            <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-pink-300">
              Admin Operations Manual
            </h1>
            <p className="text-cyan-300/40 text-xs mt-0.5 uppercase tracking-widest">
              Green Hills Karaoke · Confidential · For Admin Use Only
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 bg-slate-800/50 border border-slate-600 text-cyan-300/80 px-4 py-2 rounded-lg hover:border-red-500/50 hover:text-red-300 text-sm transition-all"
          >
            ✕ Close
          </button>
        </div>

        <div className="space-y-8">

          {/* ══════════════════════════════════════════════
              SECTION 1 — What is the Admin Dashboard?
          ══════════════════════════════════════════════ */}
          <section>
            <h2 className="text-cyan-400 font-bold text-base uppercase tracking-widest mb-3">
              1. What is the Admin Dashboard?
            </h2>
            <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-5 space-y-4 text-slate-200 text-sm leading-relaxed">
              <p>
                The Admin Dashboard is your control centre for managing all Green Hills Karaoke bookings.
                Through it, you can see who has booked, what time they are coming, how much they owe at
                check-in, and take every action needed — from checking guests in and out, to cancelling
                bookings, to blocking unavailable dates.
              </p>
              <p>
                The dashboard is password-protected. No customer can access it. Only authorised admins
                with the password can log in.
              </p>

              <div>
                <p className="font-semibold text-cyan-300 mb-2">How to Access the Dashboard</p>
                <ol className="list-decimal list-inside space-y-1 text-slate-300">
                  <li>Open any browser on your phone or computer</li>
                  <li>Go to: <span className="text-cyan-300 font-mono">greenhillsagro.net/karaoke/admin</span></li>
                  <li>Type the Admin Password when the box appears</li>
                  <li>Save this link as a bookmark on your phone — you will need it every day</li>
                </ol>
              </div>

              <div>
                <p className="font-semibold text-cyan-300 mb-2">Authorised Admin Numbers</p>
                <p className="text-slate-400 text-xs mb-2">Customers who wish to cancel their booking will be directed to call any of these numbers:</p>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-800/80">
                      <th className="text-left px-3 py-2 text-cyan-300 border border-slate-700/50 rounded-tl">Role</th>
                      <th className="text-left px-3 py-2 text-cyan-300 border border-slate-700/50 rounded-tr">WhatsApp / Phone Number</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Admin 1', '+91 90894 02122'],
                      ['Admin 2 (Business Line)', '+91 70857 66889'],
                      ['Admin 3 (Keeper / Caretaker)', '+91 84138 53992'],
                      ['Admin 4', '+91 87876 33291'],
                    ].map(([role, num]) => (
                      <tr key={role} className="border border-slate-700/30 hover:bg-slate-800/30">
                        <td className="px-3 py-2 text-slate-300">{role}</td>
                        <td className="px-3 py-2 text-green-300 font-mono">{num}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* ══════════════════════════════════════════════
              SECTION 2 — Dashboard Overview
          ══════════════════════════════════════════════ */}
          <section>
            <h2 className="text-cyan-400 font-bold text-base uppercase tracking-widest mb-3">
              2. Dashboard Overview
            </h2>
            <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-5 space-y-4 text-slate-200 text-sm leading-relaxed">
              <p>After logging in, you will see three tabs at the top of the screen:</p>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-800/80">
                    <th className="text-left px-3 py-2 text-cyan-300 border border-slate-700/50">Tab</th>
                    <th className="text-left px-3 py-2 text-cyan-300 border border-slate-700/50">What it shows</th>
                    <th className="text-left px-3 py-2 text-cyan-300 border border-slate-700/50">When to use it</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['📋 Bookings', 'All bookings for a selected date', 'Every day — your main working view'],
                    ['📊 Analytics', 'Revenue and booking totals', 'Weekly and monthly reviews'],
                    ['🚫 Blackout Dates', 'Dates blocked from online booking', 'When the venue is unavailable'],
                  ].map(([tab, desc, when]) => (
                    <tr key={tab} className="border border-slate-700/30 hover:bg-slate-800/30">
                      <td className="px-3 py-2 text-slate-200 font-medium">{tab}</td>
                      <td className="px-3 py-2 text-slate-300">{desc}</td>
                      <td className="px-3 py-2 text-slate-400">{when}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-slate-300">
                <span className="font-semibold text-cyan-300">The Bookings Tab</span> is where you will spend most of your time.
                Use the date picker at the top left to choose the date. Each booking card on screen shows:
                guest name, contact details, booked time slot and duration, total amount and balance still due at check-in,
                and the current booking status.
              </p>
            </div>
          </section>

          {/* ══════════════════════════════════════════════
              SECTION 3 — Booking Statuses
          ══════════════════════════════════════════════ */}
          <section>
            <h2 className="text-cyan-400 font-bold text-base uppercase tracking-widest mb-3">
              3. Booking Statuses — What Each One Means
            </h2>
            <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-5 text-sm leading-relaxed">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-800/80">
                    <th className="text-left px-3 py-2 text-cyan-300 border border-slate-700/50">Status</th>
                    <th className="text-left px-3 py-2 text-cyan-300 border border-slate-700/50">What it means</th>
                    <th className="text-left px-3 py-2 text-cyan-300 border border-slate-700/50">What you should do</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['🟢 CONFIRMED', 'Customer has paid the deposit (or full amount) and is booked in', 'Prepare for their arrival. Click CHECK IN the moment they walk in.'],
                    ['🔵 CHECKED IN', 'Admin has confirmed the customer has arrived', 'Session is in progress. Click CHECK OUT when they leave.'],
                    ['✅ COMPLETED', 'Session is over and the customer has left', 'No further action needed. Booking is closed.'],
                    ['🔴 CANCELLED', 'Booking has been cancelled by the customer or by admin', 'Deposit is forfeited. Slot is now free for new bookings.'],
                    ['⚫ NO SHOW', 'Customer never arrived and was not checked in before 11pm', 'Deposit is forfeited. The system marks this automatically at 11pm.'],
                  ].map(([status, meaning, action]) => (
                    <tr key={status} className="border border-slate-700/30 hover:bg-slate-800/30">
                      <td className="px-3 py-2 font-semibold text-slate-200 whitespace-nowrap">{status}</td>
                      <td className="px-3 py-2 text-slate-300">{meaning}</td>
                      <td className="px-3 py-2 text-slate-400">{action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ══════════════════════════════════════════════
              SECTION 4 — Daily Admin Workflow
          ══════════════════════════════════════════════ */}
          <section>
            <h2 className="text-cyan-400 font-bold text-base uppercase tracking-widest mb-3">
              4. The Daily Admin Workflow
            </h2>
            <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-5 space-y-5 text-sm leading-relaxed text-slate-200">
              <p className="text-slate-400">
                Follow this sequence every single day there are bookings. This is the most important part of the entire manual.
              </p>

              <div>
                <p className="font-semibold text-cyan-300 mb-2">Step 1 — Morning: Check the Day</p>
                <p className="text-slate-400 mb-2">Every morning before your shift, open the dashboard and review the day:</p>
                <ol className="list-decimal list-inside space-y-1 text-slate-300">
                  <li>Open <span className="font-mono text-cyan-300">greenhillsagro.net/karaoke/admin</span> and log in</li>
                  <li>Set the date picker to today&apos;s date</li>
                  <li>Note all CONFIRMED bookings — guest names, time slots, and balance due</li>
                  <li>Make a note of any guests paying the full balance at check-in</li>
                </ol>
                <div className="mt-3 bg-cyan-500/10 border border-cyan-500/30 text-cyan-200 rounded-lg p-3">
                  You will also receive a WhatsApp alert whenever a new booking is made. But always verify on the dashboard as well — do not rely on WhatsApp alone.
                </div>
              </div>

              <div>
                <p className="font-semibold text-red-300 mb-2">Step 2 — When a Guest Arrives: CHECK IN ⚠️ CRITICAL</p>
                <p className="text-slate-400 mb-2">
                  This is the single most important action you will perform as an admin.
                  You <span className="text-red-300 font-semibold">must</span> click CHECK IN the moment a guest walks in.
                </p>
                <ol className="list-decimal list-inside space-y-1 text-slate-300">
                  <li>Find their booking on the dashboard</li>
                  <li>Verify their identity — ask for their name and booking time</li>
                  <li>Collect the balance due if they only paid a deposit</li>
                  <li>Click the CHECK IN button on their booking card</li>
                  <li>Confirm when prompted — status changes to CHECKED IN</li>
                </ol>
                <div className="mt-3 bg-red-500/10 border border-red-500/30 text-red-200 rounded-lg p-3 font-medium">
                  If you do not click Check In, the system will automatically mark the guest as NO SHOW at 11pm — even if they came and used the room. This cannot be reversed automatically. Always click Check In without fail.
                </div>
              </div>

              <div>
                <p className="font-semibold text-cyan-300 mb-2">Step 3 — When a Guest Leaves: CHECK OUT</p>
                <ol className="list-decimal list-inside space-y-1 text-slate-300">
                  <li>Find the booking on the dashboard</li>
                  <li>Click the CHECK OUT button</li>
                  <li>Status changes to COMPLETED</li>
                  <li>Confirm all microphones and equipment are intact before the guest leaves</li>
                </ol>
                <div className="mt-3 bg-cyan-500/10 border border-cyan-500/30 text-cyan-200 rounded-lg p-3">
                  Check Out closes the session in the system and keeps your records and analytics accurate. Do not skip it.
                </div>
              </div>

              <div>
                <p className="font-semibold text-cyan-300 mb-2">Step 4 — Before 10pm Every Night</p>
                <ul className="list-disc list-inside space-y-1 text-slate-300">
                  <li>Make sure every guest who came today is marked CHECKED IN or COMPLETED</li>
                  <li>Any guest who booked but did not show up — leave their status as CONFIRMED. The system will mark them NO SHOW automatically at 11pm.</li>
                  <li>Process any cancellation requests that came in during the day</li>
                </ul>
              </div>
            </div>
          </section>

          {/* ══════════════════════════════════════════════
              SECTION 5 — Taking Offline Bookings
          ══════════════════════════════════════════════ */}
          <section>
            <h2 className="text-cyan-400 font-bold text-base uppercase tracking-widest mb-3">
              5. Taking Offline Bookings — Walk-ins &amp; Phone Bookings
            </h2>
            <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-5 space-y-5 text-sm leading-relaxed text-slate-200">
              <p>An offline booking is any booking that does not come through the online form at <span className="font-mono text-cyan-300">greenhillsagro.net/karaoke</span>. This includes:</p>
              <ul className="list-disc list-inside space-y-1 text-slate-300">
                <li>Walk-in customers who arrive at the venue and want to book on the spot</li>
                <li>Customers who call any of the admin numbers to book over the phone</li>
                <li>Customers who message admins on WhatsApp to reserve a slot</li>
              </ul>
              <div className="bg-red-500/10 border border-red-500/30 text-red-200 rounded-lg p-3 font-medium">
                You MUST enter every offline booking into the admin dashboard immediately — even before the guest walks in. If the slot is not in the system, the online booking page will show it as available and another customer could book the same time online simultaneously.
              </div>

              {/* 5.1 */}
              <div>
                <p className="font-semibold text-cyan-300 mb-2">5.1 — Information to Collect Before You Open the Dashboard</p>
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-800/80">
                      <th className="text-left px-3 py-2 text-cyan-300 border border-slate-700/50">Information Needed</th>
                      <th className="text-left px-3 py-2 text-cyan-300 border border-slate-700/50">Example</th>
                      <th className="text-left px-3 py-2 text-cyan-300 border border-slate-700/50">Why it matters</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Full name', 'Lalthansanga Pachuau', 'Appears on booking and WhatsApp confirmation'],
                      ['WhatsApp phone number', '9383198140', 'Customer receives confirmation on this number. Required.'],
                      ['Email address', 'customer@gmail.com', 'Backup contact. Enter N/A if not available.'],
                      ['Booking date', '2026-06-25', 'The date they want to come'],
                      ['Start time', '7:00 PM', 'What time their session begins'],
                      ['Duration', '2 hours', 'How long they want to book. Minimum 1 hour. Any partial hour is billed as the next full hour (e.g. 30 min = 1 hr charge, 1.5 hrs = 2 hr charge).'],
                      ['Payment type', 'Deposit or Full Payment', 'Are they paying Rs 500 deposit now, or the full amount?'],
                      ['Cash collected', 'Rs 500', 'How much they are paying right now'],
                    ].map(([info, ex, why]) => (
                      <tr key={info} className="border border-slate-700/30 hover:bg-slate-800/30">
                        <td className="px-3 py-2 text-slate-200 font-medium">{info}</td>
                        <td className="px-3 py-2 text-slate-400 font-mono text-xs">{ex}</td>
                        <td className="px-3 py-2 text-slate-400">{why}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-3 bg-cyan-500/10 border border-cyan-500/30 text-cyan-200 rounded-lg p-3">
                  If a customer does not have WhatsApp, enter their regular phone number. They will not receive the WhatsApp confirmation but the booking will still be created and the slot will be locked.
                </div>
              </div>

              {/* 5.2 */}
              <div>
                <p className="font-semibold text-cyan-300 mb-2">5.2 — How to Create the Booking: Step by Step</p>
                <p className="font-medium text-slate-300 mb-1">Step 1: Open the Admin Dashboard</p>
                <ol className="list-decimal list-inside space-y-1 text-slate-300 mb-3">
                  <li>Go to <span className="font-mono text-cyan-300">greenhillsagro.net/karaoke/admin</span></li>
                  <li>Log in with the admin password</li>
                  <li>Make sure you are on the Bookings tab</li>
                </ol>
                <p className="font-medium text-slate-300 mb-1">Step 2: Open the Create Offline Booking Form</p>
                <ol className="list-decimal list-inside space-y-1 text-slate-300 mb-3">
                  <li>Click the <span className="text-green-300 font-semibold">+ Create Offline Booking</span> button</li>
                  <li>Click it — a form will appear on screen</li>
                </ol>
                <p className="font-medium text-slate-300 mb-1">Step 3: Fill in the Form</p>
                <table className="w-full border-collapse text-sm mb-3">
                  <thead>
                    <tr className="bg-slate-800/80">
                      <th className="text-left px-3 py-2 text-cyan-300 border border-slate-700/50">Field</th>
                      <th className="text-left px-3 py-2 text-cyan-300 border border-slate-700/50">What to enter</th>
                      <th className="text-left px-3 py-2 text-cyan-300 border border-slate-700/50">Important notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Guest Name', 'Full name of the customer', 'Required'],
                      ['Phone Number', 'WhatsApp number', 'Required. No spaces or + sign needed. Example: 9383198140'],
                      ['Email', 'Email address', 'Optional. Type N/A if not available.'],
                      ['Date', 'The booking date', 'Format must be YYYY-MM-DD. Example: 2026-06-25'],
                      ['Start Time', 'A number code for the start time', 'Do NOT type the time directly. Use the chart in Section 5.3 to find the correct number.'],
                      ['Duration', 'Length of session in minutes', '1 hr = 60 | 1.5 hrs = 90 | 2 hrs = 120 | 3 hrs = 180 | 4 hrs = 240. Note: any partial hour is billed as the next full hour.'],
                      ['Payment Type', 'Type either: deposit or full', 'deposit = Rs 500 only. full = paying everything now.'],
                      ['Amount Paid', 'The exact cash amount collected', 'Example: 500 for a deposit. Enter 0 if nothing was collected yet.'],
                    ].map(([field, what, note]) => (
                      <tr key={field} className="border border-slate-700/30 hover:bg-slate-800/30">
                        <td className="px-3 py-2 text-slate-200 font-medium whitespace-nowrap">{field}</td>
                        <td className="px-3 py-2 text-slate-300">{what}</td>
                        <td className="px-3 py-2 text-slate-400 text-xs">{note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="font-medium text-slate-300 mb-1">Step 4: Double-Check and Submit</p>
                <ol className="list-decimal list-inside space-y-1 text-slate-300">
                  <li>Read through every field before submitting</li>
                  <li>Pay special attention to the date and start time code — these are the most common mistakes</li>
                  <li>Click Submit</li>
                  <li>The booking will appear immediately in the dashboard for that date</li>
                  <li>The customer will receive a WhatsApp confirmation message automatically</li>
                </ol>
                <div className="mt-3 bg-yellow-500/10 border border-yellow-500/30 text-yellow-200 rounded-lg p-3">
                  If you enter the wrong date or time and submit, it is difficult to undo. Always double-check before clicking submit.
                </div>
              </div>

              {/* 5.3 Time Chart */}
              <div>
                <p className="font-semibold text-cyan-300 mb-1">5.3 — Start Time Quick Reference Chart</p>
                <p className="text-slate-400 mb-1 text-xs">
                  The booking form does not accept times like &quot;7:00 PM&quot; — it requires a number code.
                  Simply find the time your customer wants and type the matching number into the Start Time field.
                  On-the-hour times are highlighted in green.
                </p>
                <p className="text-slate-300 text-xs mb-3 font-mono">
                  Quick examples: 10:00 AM = 600 | 12:00 PM (noon) = 720 | 2:00 PM = 840 | 5:00 PM = 1020 | 7:00 PM = 1140 | 9:30 PM = 1290 | 11:00 PM = 1380 | 12:00 AM = 1440
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-800/80">
                        {[0, 1, 2, 3].map((col) => (
                          <>
                            <th key={`t${col}`} className="text-left px-2 py-1.5 text-cyan-300 border border-slate-700/50 w-28">Time</th>
                            <th key={`c${col}`} className="text-left px-2 py-1.5 text-cyan-300 border border-slate-700/50 w-16">Code</th>
                          </>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: CHART_COLS[0].length }).map((_, rowIdx) => (
                        <tr key={rowIdx} className="border border-slate-700/20 hover:bg-slate-800/20">
                          {[0, 1, 2, 3].map((col) => {
                            const entry = CHART_COLS[col][rowIdx];
                            if (!entry) return <><td key={`t${col}`} className="border border-slate-700/20 px-2 py-1" /><td key={`c${col}`} className="border border-slate-700/20 px-2 py-1" /></>;
                            const isHour = entry.code % 60 === 0;
                            return (
                              <>
                                <td key={`t${col}`} className={`px-2 py-1 border border-slate-700/20 ${isHour ? 'text-green-300 font-semibold' : 'text-slate-300'}`}>
                                  {entry.time}
                                </td>
                                <td key={`c${col}`} className={`px-2 py-1 border border-slate-700/20 font-mono ${isHour ? 'text-green-300 font-bold' : 'text-slate-400'}`}>
                                  {entry.code}
                                </td>
                              </>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 5.4 */}
              <div>
                <p className="font-semibold text-cyan-300 mb-2">5.4 — After Creating the Booking</p>
                <ul className="list-disc list-inside space-y-1 text-slate-300">
                  <li>Confirm the booking appears on the correct date in the dashboard</li>
                  <li>Ask the customer to check their WhatsApp for the confirmation message</li>
                  <li>The confirmation includes a Cancellation Token — the customer needs this if they cancel online. If they call to cancel instead, you handle it from the admin dashboard.</li>
                  <li>Collect cash payment now — either Rs 500 deposit or full amount</li>
                  <li>Verbally remind the customer of the check-in time and karaoke room rules</li>
                </ul>
                <div className="mt-3 bg-cyan-500/10 border border-cyan-500/30 text-cyan-200 rounded-lg p-3">
                  If the customer does not receive a WhatsApp confirmation within 2 minutes, check that you entered their number correctly on the booking form.
                </div>
              </div>

              {/* 5.5 Pricing */}
              <div>
                <p className="font-semibold text-cyan-300 mb-1">5.5 — Pricing Reference</p>
                <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-200 rounded-lg p-3 mb-3 text-xs">
                  <strong>Billing rule:</strong> Any partial hour is always rounded up to the next full hour.
                  30 minutes = 1 hour charge. 1.5 hours = 2 hour charge. 2.5 hours = 3 hour charge.
                  There is no pro-rated half-hour rate.
                </div>
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-800/80">
                      {['Duration Booked', 'Billed As', 'Rate', 'Total Charge', 'Deposit', 'Balance at Venue'].map((h) => (
                        <th key={h} className="text-left px-3 py-2 text-cyan-300 border border-slate-700/50">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Up to 1 hour (incl. 30 min)', '1 hour', 'Rs 1,180/hr', 'Rs 1,180', 'Rs 500', 'Rs 680'],
                      ['1.5 hours', '2 hours ↑', 'Rs 1,180/hr', 'Rs 2,360', 'Rs 500', 'Rs 1,860'],
                      ['2 hours', '2 hours', 'Rs 1,180/hr', 'Rs 2,360', 'Rs 500', 'Rs 1,860'],
                      ['2.5 hours', '3 hours ↑', 'Rs 1,180/hr', 'Rs 3,540', 'Rs 500', 'Rs 3,040'],
                      ['3 hours', '3 hours', 'Rs 1,180/hr', 'Rs 3,540', 'Rs 500', 'Rs 3,040'],
                      ['4 hours', '4 hours', 'Rs 1,180/hr', 'Rs 4,720', 'Rs 500', 'Rs 4,220'],
                    ].map(([dur, billed, rate, total, dep, bal]) => {
                      const isRoundUp = billed.includes('↑');
                      return (
                        <tr key={dur} className={`border border-slate-700/30 hover:bg-slate-800/30 ${isRoundUp ? 'bg-yellow-500/5' : ''}`}>
                          <td className="px-3 py-2 text-slate-200 font-medium">{dur}</td>
                          <td className={`px-3 py-2 font-semibold ${isRoundUp ? 'text-yellow-300' : 'text-slate-400'}`}>{billed}</td>
                          <td className="px-3 py-2 text-slate-400">{rate}</td>
                          <td className="px-3 py-2 text-green-300 font-semibold">{total}</td>
                          <td className="px-3 py-2 text-slate-400">{dep}</td>
                          <td className="px-3 py-2 text-yellow-300">{bal}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* 5.6 Walk-in scenario */}
              <div>
                <p className="font-semibold text-cyan-300 mb-2">5.6 — Walk-in Scenario: Full Example</p>
                <p className="text-slate-400 mb-2 text-xs">
                  Scenario: A customer walks in at 6:45 PM on June 25 and wants to book from 7:00 PM for 2 hours. They want to pay Rs 500 deposit now and the rest at check-in.
                </p>
                <ol className="list-decimal list-inside space-y-1 text-slate-300">
                  <li>Ask for: name, WhatsApp number, email (optional)</li>
                  <li>Open the admin dashboard → Create Offline Booking</li>
                  <li>Fill in: Date 2026-06-25 | Start Time <span className="font-mono text-green-300">1140</span> | Duration 120 | Payment: deposit | Amount: 500</li>
                  <li>Click Submit</li>
                  <li>Confirm it shows on the dashboard for June 25, 7:00 PM – 9:00 PM</li>
                  <li>Collect Rs 500 cash from the customer</li>
                  <li>Tell them the remaining balance at check-in is Rs 1,860</li>
                  <li>At 7:00 PM when they arrive — click Check In on the dashboard</li>
                  <li>At 9:00 PM when they leave — click Check Out</li>
                </ol>
              </div>

              {/* 5.7 Phone booking scenario */}
              <div>
                <p className="font-semibold text-cyan-300 mb-2">5.7 — Phone Booking Scenario: Full Example</p>
                <p className="text-slate-400 mb-2 text-xs">
                  Scenario: A customer calls at 2 PM and wants to book tomorrow (June 26) from 8:00 PM for 1 hour. They will pay the full amount at the venue when they arrive.
                </p>
                <ol className="list-decimal list-inside space-y-1 text-slate-300">
                  <li>Collect their name and WhatsApp number over the phone</li>
                  <li>Open the admin dashboard → Create Offline Booking</li>
                  <li>Fill in: Date 2026-06-26 | Start Time <span className="font-mono text-green-300">1200</span> | Duration 60 | Payment: full | Amount: 0</li>
                  <li>Click Submit — the slot is now LOCKED. No one else can book 8:00 PM on June 26 online.</li>
                  <li>Customer receives WhatsApp confirmation</li>
                  <li>When they arrive the next day: collect Rs 1,180 cash, then click Check In</li>
                  <li>When they leave: click Check Out</li>
                </ol>
                <div className="mt-3 bg-yellow-500/10 border border-yellow-500/30 text-yellow-200 rounded-lg p-3">
                  For phone bookings where no deposit has been collected upfront, consider requesting a UPI transfer of at least Rs 500 as deposit before entering the booking. This reduces the risk of no-shows.
                </div>
              </div>
            </div>
          </section>

          {/* ══════════════════════════════════════════════
              SECTION 6 — Admin Actions / Buttons
          ══════════════════════════════════════════════ */}
          <section>
            <h2 className="text-cyan-400 font-bold text-base uppercase tracking-widest mb-3">
              6. Admin Actions — What Each Button Does
            </h2>
            <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-5 space-y-4 text-sm leading-relaxed text-slate-200">
              {[
                {
                  title: 'Check In',
                  color: 'text-green-300',
                  items: [
                    'When to use: The moment the customer physically walks into the venue',
                    'What it does: Changes booking status from CONFIRMED to CHECKED IN',
                    'WhatsApp sent: Customer receives a check-in confirmation message',
                    'Admins notified: Yes — all admins receive a check-in alert',
                  ],
                  warn: null,
                },
                {
                  title: 'Check Out',
                  color: 'text-blue-300',
                  items: [
                    'When to use: When the session ends and the customer is leaving',
                    'What it does: Changes status from CHECKED IN to COMPLETED',
                    'WhatsApp sent: Customer receives a session-complete message',
                    'Admins notified: Yes — all admins receive a check-out alert',
                  ],
                  warn: null,
                },
                {
                  title: 'Cancel',
                  color: 'text-red-300',
                  items: [
                    'When to use: When a customer calls to cancel, or in an emergency',
                    'What it does: Changes status to CANCELLED. Slot is freed for new bookings.',
                    'Deposit rule: The Rs 500 deposit is ALWAYS non-refundable, no exceptions',
                    'WhatsApp sent: Customer receives cancellation confirmation. All admins are notified.',
                  ],
                  warn: 'Once you cancel a booking, it cannot be un-cancelled from the dashboard. If you cancel by mistake, contact the main administrator immediately.',
                },
                {
                  title: 'Edit',
                  color: 'text-yellow-300',
                  items: [
                    'When to use: Customer wants to reschedule, or a mistake was made in the original entry',
                    'What it does: Updates booking details (date, time, duration, guest name) in real time',
                    'WhatsApp sent: No automatic notification — inform the customer manually after making changes',
                  ],
                  warn: null,
                },
                {
                  title: '+ Create Offline Booking',
                  color: 'text-cyan-300',
                  items: [
                    'When to use: Walk-in customer or phone/WhatsApp booking (see Section 5 for full guide)',
                    'What it does: Creates a new booking manually and locks the slot immediately',
                    'WhatsApp sent: Customer receives the same confirmation message as an online booking',
                  ],
                  warn: null,
                },
              ].map(({ title, color, items, warn }) => (
                <div key={title} className="border border-slate-700/40 rounded-lg p-4 bg-slate-800/20">
                  <p className={`font-bold mb-2 ${color}`}>{title}</p>
                  <ul className="list-disc list-inside space-y-1 text-slate-300">
                    {items.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                  {warn && (
                    <div className="mt-3 bg-red-500/10 border border-red-500/30 text-red-200 rounded-lg p-3">
                      {warn}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* ══════════════════════════════════════════════
              SECTION 7 — Payment & Refund Policy
          ══════════════════════════════════════════════ */}
          <section>
            <h2 className="text-cyan-400 font-bold text-base uppercase tracking-widest mb-3">
              7. Payment &amp; Refund Policy
            </h2>
            <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-5 space-y-4 text-sm leading-relaxed text-slate-200">
              <p className="text-slate-400">Every admin must know this policy and communicate it consistently to customers. There is no flexibility on the deposit rule.</p>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-800/80">
                    <th className="text-left px-3 py-2 text-cyan-300 border border-slate-700/50">Scenario</th>
                    <th className="text-left px-3 py-2 text-cyan-300 border border-slate-700/50">Refund Policy</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Customer paid Rs 500 deposit only, then cancels', 'Rs 500 deposit is NON-REFUNDABLE. No exceptions under any circumstances.'],
                    ['Customer paid full amount, cancels with advance notice', 'Rs 500 non-refundable. Remaining balance at admin discretion based on reason.'],
                    ['Customer paid full amount, cancels on the same day', 'Rs 500 non-refundable. Remaining balance — no refund as a general rule.'],
                    ['Customer paid full amount, genuine emergency (illness, accident, etc.)', 'Rs 500 non-refundable. Remaining balance refund at admin discretion.'],
                    ['Customer is a NO SHOW (did not arrive at all)', 'Full deposit forfeited. No refund under any circumstances.'],
                    ['Customer violates rules and is asked to leave early', 'No refund. Session ended due to misconduct — at admin discretion.'],
                  ].map(([scenario, policy]) => (
                    <tr key={scenario} className="border border-slate-700/30 hover:bg-slate-800/30">
                      <td className="px-3 py-2 text-slate-300">{scenario}</td>
                      <td className="px-3 py-2 text-yellow-200">{policy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="bg-red-500/10 border border-red-500/30 text-red-200 rounded-lg p-3">
                Never promise a refund to a customer without first consulting the main administrator. Refunds are at admin discretion and are not automatic.
              </div>
            </div>
          </section>

          {/* ══════════════════════════════════════════════
              SECTION 8 — WhatsApp Notifications
          ══════════════════════════════════════════════ */}
          <section>
            <h2 className="text-cyan-400 font-bold text-base uppercase tracking-widest mb-3">
              8. WhatsApp Notifications — What Gets Sent and When
            </h2>
            <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-5 space-y-4 text-sm leading-relaxed text-slate-200">
              <p className="text-slate-400">The system sends automatic WhatsApp messages at each key event. You do not need to send these manually.</p>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-800/80">
                    <th className="text-left px-3 py-2 text-cyan-300 border border-slate-700/50">Event</th>
                    <th className="text-left px-3 py-2 text-cyan-300 border border-slate-700/50">Customer receives?</th>
                    <th className="text-left px-3 py-2 text-cyan-300 border border-slate-700/50">Admins receive?</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Customer books online', 'Yes — Booking confirmation + Rules & Regulations + Cancellation Token', 'Yes — New booking alert with guest details'],
                    ['Admin creates offline booking', 'Yes — Same full confirmation message', 'Yes — New booking alert'],
                    ['Guest checks in', 'Yes — Check-in confirmation', 'Yes — Check-in alert'],
                    ['Guest checks out', 'Yes — Session complete message', 'Yes — Check-out alert'],
                    ['Booking cancelled (any method)', 'Yes — Cancellation confirmation', 'Yes — Cancellation alert'],
                    ['No show (automatic at 11pm)', 'No message sent', 'Yes — No-show alert sent to all admins'],
                  ].map(([event, cust, admin]) => (
                    <tr key={event} className="border border-slate-700/30 hover:bg-slate-800/30">
                      <td className="px-3 py-2 text-slate-200 font-medium">{event}</td>
                      <td className="px-3 py-2 text-green-300 text-xs">{cust}</td>
                      <td className="px-3 py-2 text-cyan-300 text-xs">{admin}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="bg-cyan-500/10 border border-cyan-500/30 text-cyan-200 rounded-lg p-3">
                If a customer says they did not receive a WhatsApp message, check that their phone number was entered correctly in the booking. Ask them to check their WhatsApp — not just regular SMS.
              </div>
            </div>
          </section>

          {/* ══════════════════════════════════════════════
              SECTION 9 — Blackout Dates
          ══════════════════════════════════════════════ */}
          <section>
            <h2 className="text-cyan-400 font-bold text-base uppercase tracking-widest mb-3">
              9. Blackout Dates — Blocking the Venue
            </h2>
            <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-5 space-y-4 text-sm leading-relaxed text-slate-200">
              <p>
                Use Blackout Dates when the karaoke room is unavailable and you need to stop customers from booking online on that date —
                for example, during maintenance, a private event, or a public holiday when you are closed.
              </p>
              <div>
                <p className="font-semibold text-cyan-300 mb-2">How to Block a Date</p>
                <ol className="list-decimal list-inside space-y-1 text-slate-300">
                  <li>Go to the Blackout Dates tab</li>
                  <li>Select the date you want to block using the date picker</li>
                  <li>Click Block Date</li>
                  <li>The date is now blocked — customers will not be able to select it when booking online</li>
                </ol>
              </div>
              <div>
                <p className="font-semibold text-cyan-300 mb-2">How to Remove a Blackout Date</p>
                <ol className="list-decimal list-inside space-y-1 text-slate-300">
                  <li>Go to the Blackout Dates tab</li>
                  <li>Find the blocked date in the list</li>
                  <li>Click Remove / Unblock</li>
                  <li>The date is now open for bookings again</li>
                </ol>
              </div>
              <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-200 rounded-lg p-3">
                Blackout Dates do NOT automatically cancel existing bookings on that date. If someone has already booked before you blocked the date, you must cancel their booking manually from the Bookings tab and inform them.
              </div>
            </div>
          </section>

          {/* ══════════════════════════════════════════════
              SECTION 10 — Room Rules
          ══════════════════════════════════════════════ */}
          <section>
            <h2 className="text-cyan-400 font-bold text-base uppercase tracking-widest mb-3">
              10. Karaoke Room Rules &amp; Regulations
            </h2>
            <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-5 space-y-4 text-sm leading-relaxed text-slate-200">
              <p className="text-slate-400">
                These rules are automatically sent to every customer in their WhatsApp booking confirmation.
                All admins must enforce these rules without exception.
              </p>
              <ol className="list-decimal list-inside space-y-2 text-slate-200">
                {[
                  'No outside food or beverages allowed',
                  'Alcohol and drugs strictly prohibited',
                  'Smoking only in the designated outdoor area',
                  'Handle microphones and all equipment with care',
                  'Equipment damage will be charged to the guest',
                  'The deposit is strictly non-refundable',
                  'Late arrivals will NOT receive extra time',
                  'Extensions are subject to availability — request in advance',
                  'Minors (under 18) must be accompanied by a parent or guardian',
                  'Maintain sound levels within management limits',
                  'Respect staff and fellow guests at all times',
                  'Misconduct may result in immediate session termination without refund',
                  'Management reserves the right to refuse entry or service',
                ].map((rule, i) => (
                  <li key={i} className="ml-2">{rule}</li>
                ))}
              </ol>
              <div className="bg-red-500/10 border border-red-500/30 text-red-200 rounded-lg p-3">
                If a guest violates any of the above rules, you have full authority to terminate their session immediately. No refund is issued for misconduct.
              </div>
            </div>
          </section>

          {/* ══════════════════════════════════════════════
              SECTION 11 — Common Problems
          ══════════════════════════════════════════════ */}
          <section>
            <h2 className="text-cyan-400 font-bold text-base uppercase tracking-widest mb-3">
              11. Common Problems &amp; What to Do
            </h2>
            <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-5 text-sm leading-relaxed">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-800/80">
                    <th className="text-left px-3 py-2 text-cyan-300 border border-slate-700/50">Problem</th>
                    <th className="text-left px-3 py-2 text-cyan-300 border border-slate-700/50">Most likely cause</th>
                    <th className="text-left px-3 py-2 text-cyan-300 border border-slate-700/50">What to do</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    [
                      'Bookings not loading / page shows nothing',
                      'Wrong date selected, or you just logged in and the page is still loading',
                      'Wait 5 seconds and click Refresh. If still failing, log out and log back in.',
                    ],
                    [
                      "Customer says they didn't receive a WhatsApp confirmation",
                      'Wrong number entered, or WhatsApp not active on that number',
                      'Check the phone number in the booking. Manually send the booking details if needed.',
                    ],
                    [
                      'Guest is marked NO SHOW but they actually came',
                      'Admin forgot to click Check In before 11pm',
                      'Contact the main administrator. They will need to fix this manually.',
                    ],
                    [
                      '"Already checked in" or "Already completed" error appears',
                      'Booking may already be cancelled or completed',
                      'Refresh the page and check the current status of the booking.',
                    ],
                    [
                      'Customer wants to reschedule',
                      'No automatic reschedule tool exists',
                      'Cancel the old booking. Create a new offline booking for the new time. Collect deposit again.',
                    ],
                    [
                      'Two customers trying to book the same slot',
                      'Race condition — rare but possible',
                      'The system will reject the second booking automatically. Check with both customers.',
                    ],
                    [
                      'Wrong time or date entered on offline booking',
                      'Data entry error',
                      'Contact the main administrator immediately. Do not try to fix it yourself.',
                    ],
                    [
                      'Balance due on dashboard seems wrong',
                      'Deposit amount or total may have been entered incorrectly',
                      'Contact the main administrator to verify and correct.',
                    ],
                  ].map(([problem, cause, action]) => (
                    <tr key={problem} className="border border-slate-700/30 hover:bg-slate-800/30">
                      <td className="px-3 py-2 text-slate-200">{problem}</td>
                      <td className="px-3 py-2 text-slate-400 text-xs">{cause}</td>
                      <td className="px-3 py-2 text-cyan-300 text-xs">{action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ══════════════════════════════════════════════
              SECTION 12 — Daily Checklist
          ══════════════════════════════════════════════ */}
          <section>
            <h2 className="text-cyan-400 font-bold text-base uppercase tracking-widest mb-3">
              12. Daily Admin Checklist
            </h2>
            <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-5 space-y-5 text-sm leading-relaxed text-slate-200">
              {[
                {
                  phase: 'MORNING (Start of Shift)',
                  color: 'text-yellow-300 border-yellow-500/30 bg-yellow-500/5',
                  items: [
                    'Open dashboard — set date to today',
                    'Note all CONFIRMED bookings, times, and balances due',
                    'Check if any dates need to be blocked (Blackout Dates tab)',
                  ],
                },
                {
                  phase: 'WHEN A WALK-IN OR PHONE BOOKING COMES IN',
                  color: 'text-cyan-300 border-cyan-500/30 bg-cyan-500/5',
                  items: [
                    'Collect: name, WhatsApp number, date, start time, duration, payment',
                    'Open dashboard → Create Offline Booking',
                    'Use the Start Time Chart (Section 5.3) to find the correct code',
                    'Double-check all fields before submitting',
                    'Collect cash payment immediately',
                    'Confirm the customer received their WhatsApp confirmation',
                  ],
                },
                {
                  phase: 'WHEN A GUEST ARRIVES',
                  color: 'text-green-300 border-green-500/30 bg-green-500/5',
                  items: [
                    'Verify their name and booking time on the dashboard',
                    'Collect the balance due if they only paid a deposit',
                    'Click CHECK IN immediately — do not delay',
                    'Remind them of the session end time',
                  ],
                },
                {
                  phase: 'WHEN A GUEST LEAVES',
                  color: 'text-blue-300 border-blue-500/30 bg-blue-500/5',
                  items: [
                    'Click CHECK OUT on the dashboard',
                    'Check that all microphones and equipment are intact',
                    'Clean and prepare the room for the next guest',
                  ],
                },
                {
                  phase: 'BEFORE 10PM (End of Night)',
                  color: 'text-red-300 border-red-500/30 bg-red-500/5',
                  items: [
                    'Every guest who came today must be marked CHECKED IN or COMPLETED',
                    'Any no-shows — leave them as CONFIRMED. System marks NO SHOW at 11pm.',
                    'Process any pending cancellation requests',
                    'Review the day on the Analytics tab if needed',
                  ],
                },
              ].map(({ phase, color, items }) => (
                <div key={phase} className={`border rounded-lg p-4 ${color}`}>
                  <p className="font-bold mb-2">{phase}</p>
                  <ul className="space-y-1.5">
                    {items.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-slate-300">
                        <span className="mt-0.5 text-slate-500">☐</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {/* ══════════════════════════════════════════════
              SECTION 13 — Emergency Contacts
          ══════════════════════════════════════════════ */}
          <section>
            <h2 className="text-cyan-400 font-bold text-base uppercase tracking-widest mb-3">
              13. Emergency Contacts
            </h2>
            <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-5 text-sm leading-relaxed">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-800/80">
                    <th className="text-left px-3 py-2 text-cyan-300 border border-slate-700/50">Number</th>
                    <th className="text-left px-3 py-2 text-cyan-300 border border-slate-700/50">Role</th>
                    <th className="text-left px-3 py-2 text-cyan-300 border border-slate-700/50">When to call</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['+91 90894 02122', 'Admin 1', 'Any booking issue, system problem, or general query'],
                    ['+91 70857 66889', 'Admin 2 (Business Line)', 'Payments, refunds, technical system issues'],
                    ['+91 84138 53992', 'Keeper / Caretaker', 'On-site emergencies, equipment damage, venue issues'],
                    ['+91 87876 33291', 'Admin 4', 'Any booking issue or general query'],
                  ].map(([num, role, when]) => (
                    <tr key={num} className="border border-slate-700/30 hover:bg-slate-800/30">
                      <td className="px-3 py-2 text-green-300 font-mono font-semibold">{num}</td>
                      <td className="px-3 py-2 text-slate-200 font-medium">{role}</td>
                      <td className="px-3 py-2 text-slate-400">{when}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Footer */}
          <div className="text-center text-slate-600 text-xs pt-4 border-t border-slate-800/50">
            Green Hills Karaoke · Admin Operations Manual · Confidential · For Admin Use Only<br />
            Green Hills Hotel &amp; Resort · Lamka, Manipur
          </div>

        </div>
      </div>
    </div>
  );
}
