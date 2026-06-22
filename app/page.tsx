'use client';

import { useState, useMemo, useRef, useCallback } from 'react';
import Image from 'next/image';

type BookingStep = 'date' | 'timeline' | 'form' | 'payment' | 'confirmation';
type PaymentType = 'full' | 'deposit';

interface BookedRange { start: number; end: number; bookingId: string; }

// Customer timeline: 1 PM – 10 PM
const TL_START = 780;   // 13 × 60
const TL_END   = 1320;  // 22 × 60
const TL_SPAN  = TL_END - TL_START;

const DURATION_OPTS = [
  { label: '30 min', value: 30 },
  { label: '1 hr',   value: 60 },
  { label: '1.5 hr', value: 90 },
  { label: '2 hr',   value: 120 },
  { label: '2.5 hr', value: 150 },
  { label: '3 hr',   value: 180 },
  { label: '4 hr',   value: 240 },
  { label: '5 hr',   value: 300 },
  { label: '6 hr',   value: 360 },
];

const RATE = parseInt(process.env.NEXT_PUBLIC_HOURLY_RATE || '1180');
const DEPOSIT = parseInt(process.env.NEXT_PUBLIC_DEPOSIT_AMOUNT || '500');

function minutesToTime(min: number): string {
  if (min >= 1440) return '12:00 AM';
  const h = Math.floor(min / 60);
  const m = min % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  const dh = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${dh}:${m.toString().padStart(2, '0')} ${period}`;
}

function fmtDuration(min: number): string {
  const h = Math.floor(min / 60), m = min % 60;
  if (m === 0) return `${h} hr${h !== 1 ? 's' : ''}`;
  if (h === 0) return `${m} min`;
  return `${h}h ${m}min`;
}

const pctL = (min: number) => `${((min - TL_START) / TL_SPAN * 100).toFixed(3)}%`;
const pctW = (dur: number) => `${(dur / TL_SPAN * 100).toFixed(3)}%`;
const overlaps = (aS: number, aE: number, bS: number, bE: number) => aS < bE && aE > bS;

export default function BookingPage() {
  const [step, setStep] = useState<BookingStep>('date');
  const [selectedDate, setSelectedDate] = useState('');
  const [bookedRanges, setBookedRanges] = useState<BookedRange[]>([]);
  const [isBlackout, setIsBlackout] = useState(false);
  const [dateLoading, setDateLoading] = useState(false);
  const [dateError, setDateError] = useState('');
  const [selectedStart, setSelectedStart] = useState<number | null>(null);
  const [selectedDuration, setSelectedDuration] = useState(60);
  const [formData, setFormData] = useState({ customerName: '', customerEmail: '', customerPhone: '', vipMember: false, specialRequests: '' });
  const [bookingData, setBookingData] = useState({ bookingId: '', totalAmount: 0, paidAmount: 0, balanceDue: 0, paymentType: '' as PaymentType | '', cancellationToken: '' });
  const [paymentChoiceLoading, setPaymentChoiceLoading] = useState<'' | 'full' | 'deposit'>('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const [bookingCancelled, setBookingCancelled] = useState(false);
  const [confirmError, setConfirmError] = useState('');
  const timelineRef = useRef<HTMLDivElement>(null);

  const selectionValid = useMemo(() => {
    if (selectedStart === null) return false;
    const end = selectedStart + selectedDuration;
    if (selectedStart < TL_START || end > TL_END) return false;
    return !bookedRanges.some(r => overlaps(selectedStart, end, r.start, r.end));
  }, [selectedStart, selectedDuration, bookedRanges]);

  const totalAmount = Math.ceil(selectedDuration / 60) * RATE;

  const fetchAvailability = async (date: string) => {
    setDateLoading(true); setDateError('');
    try {
      const res = await fetch(`/api/availability?date=${date}`);
      const data = await res.json();
      if (data.success) {
        setIsBlackout(!!data.data.blackout);
        setBookedRanges(data.data.bookedRanges ?? []);
        setSelectedStart(null);
        setStep('timeline');
      } else { setDateError(data.error || 'Failed to fetch availability'); }
    } catch { setDateError('Error fetching availability'); }
    finally { setDateLoading(false); }
  };

  const handleTimelineClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const snapped = Math.round((TL_START + (x / rect.width) * TL_SPAN) / 5) * 5;
    setSelectedStart(Math.max(TL_START, Math.min(TL_END - selectedDuration, snapped)));
  }, [selectedDuration]);

  const handlePaymentChoice = async (type: PaymentType) => {
    const razorpayKey = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    if (!razorpayKey || selectedStart === null) return;
    setPaymentChoiceLoading(type); setConfirmError('');
    try {
      const res = await fetch('/api/bookings/initiate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate, startTime: selectedStart, duration: selectedDuration,
          customerName: formData.customerName, customerEmail: formData.customerEmail,
          customerPhone: formData.customerPhone, paymentType: type,
          specialRequests: formData.specialRequests }),
      });
      const data = await res.json();
      if (!data.success) { setConfirmError(data.error || 'Failed to initiate payment'); setPaymentChoiceLoading(''); return; }
      const { bookingId, totalAmount: total, razorpayOrder } = data.data;
      const paid = Math.round(razorpayOrder.amount / 100);
      setBookingData({ bookingId, totalAmount: total, paidAmount: paid, balanceDue: total - paid, paymentType: type, cancellationToken: '' });
      const options = {
        key: razorpayKey, order_id: razorpayOrder.id, amount: razorpayOrder.amount,
        currency: razorpayOrder.currency || 'INR', name: 'Green Hills Karaoke',
        description: `${selectedDate} · ${minutesToTime(selectedStart)} – ${minutesToTime(selectedStart + selectedDuration)}`,
        handler: async (response: any) => {
          try {
            const cr = await fetch('/api/bookings/confirm', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id, razorpay_signature: response.razorpay_signature,
                bookingId, date: selectedDate, startTime: selectedStart, duration: selectedDuration,
                customerName: formData.customerName, customerEmail: formData.customerEmail,
                customerPhone: formData.customerPhone, paymentType: type,
                specialRequests: formData.specialRequests }),
            });
            const cd = await cr.json();
            if (cd.success) {
              const token = cd.data?.cancellationToken ?? '';
              if (token) sessionStorage.setItem(`cancelToken_${bookingId}`, token);
              setBookingData((prev) => ({ ...prev, cancellationToken: token }));
              setStep('confirmation');
            } else {
              setConfirmError(cd.error || 'Payment verification failed');
            }
          } catch { setConfirmError('Payment verification error'); }
        },
        prefill: { name: formData.customerName, email: formData.customerEmail, contact: formData.customerPhone },
        theme: { color: '#00D9FF' },
      };
      const openRzp = () => { const rzp = new (window as any).Razorpay(options); rzp.open(); };
      if ((window as any).Razorpay) { openRzp(); }
      else { const s = document.createElement('script'); s.src = 'https://checkout.razorpay.com/v1/checkout.js'; s.async = true; s.onload = openRzp; document.body.appendChild(s); }
    } catch { setConfirmError('Error initiating payment'); }
    finally { setPaymentChoiceLoading(''); }
  };

  const handleCancelBooking = async () => {
    if (!confirm(`⚠️ Cancellation will forfeit your ₹${DEPOSIT} non-refundable deposit. Continue?`)) return;

    let token = bookingData.cancellationToken || sessionStorage.getItem(`cancelToken_${bookingData.bookingId}`) || '';
    if (!token) {
      token = window.prompt('Enter your cancellation token (found in your WhatsApp booking confirmation):') ?? '';
    }
    if (!token.trim()) {
      setConfirmError('Cancellation token is required. Check your WhatsApp booking confirmation message.');
      return;
    }

    setCancelLoading(true);
    try {
      const res = await fetch(`/api/bookings/${bookingData.bookingId}/cancel`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerPhone: formData.customerPhone, cancellationToken: token.trim() }),
      });
      const data = await res.json();
      if (data.success) setBookingCancelled(true); else setConfirmError(data.error || 'Cancellation failed');
    } catch { setConfirmError('Error cancelling booking'); }
    finally { setCancelLoading(false); }
  };

  const resetAll = () => {
    setStep('date'); setSelectedDate(''); setBookedRanges([]); setIsBlackout(false);
    setSelectedStart(null); setSelectedDuration(60); setBookingCancelled(false);
    setFormData({ customerName: '', customerEmail: '', customerPhone: '', vipMember: false, specialRequests: '' });
    if (bookingData.bookingId) sessionStorage.removeItem(`cancelToken_${bookingData.bookingId}`);
    setBookingData({ bookingId: '', totalAmount: 0, paidAmount: 0, balanceDue: 0, paymentType: '', cancellationToken: '' });
    setConfirmError('');
  };

  const hourLabels = Array.from({ length: 10 }, (_, i) => TL_START + i * 60);
  const steps: BookingStep[] = ['date','timeline','form','payment','confirmation'];

  return (
    <div className="min-h-screen bg-slate-950 py-12 px-4 relative overflow-hidden">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-pink-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0.8s' }} />
        <div className="absolute top-1/2 left-1/3 w-80 h-80 bg-violet-500/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1.6s' }} />
      </div>

      <div className="max-w-2xl mx-auto relative z-10">
        {/* Header */}
        <div className="mb-10 text-center">
          <div className="mb-5 flex justify-center">
            <Image src="/logo.png" alt="Green Hills Karaoke" width={110} height={110} className="opacity-90 drop-shadow-lg" style={{ filter: 'drop-shadow(0 0 20px rgba(34,197,94,0.4))' }} />
          </div>
          <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-pink-300 to-violet-300" style={{ textShadow: '0 0 40px rgba(0,217,255,0.5)' }}>GREEN HILLS</h1>
          <p className="text-2xl font-bold text-green-300 mt-1" style={{ textShadow: '0 0 25px rgba(34,197,94,0.8)' }}>KARAOKE</p>
          <p className="text-cyan-300/70 mt-2 animate-pulse text-sm">Reserve Your Night • Live Your Song</p>
        </div>

        {/* Step dots */}
        <div className="mb-8 flex justify-center gap-3">
          {steps.map((s, i) => (
            <div key={s} className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              step === s ? 'bg-gradient-to-r from-cyan-400 to-pink-400 text-slate-900 scale-125 shadow-lg shadow-cyan-400/60'
              : i < steps.indexOf(step) ? 'bg-gradient-to-r from-cyan-500/60 to-pink-500/60 text-white'
              : 'bg-slate-800 border border-slate-700 text-slate-500'}`}>{i + 1}</div>
          ))}
        </div>

        {/* Main card */}
        <div className="backdrop-blur-xl bg-slate-900/50 border border-cyan-400/30 rounded-2xl p-7 shadow-2xl shadow-cyan-400/15 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-cyan-500/15 to-transparent rounded-bl-full blur-2xl pointer-events-none" />

          {/* ── DATE ── */}
          {step === 'date' && (
            <div className="space-y-5 relative z-10">
              <div>
                <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-pink-300">Pick Your Date</h2>
                <p className="text-cyan-300/50 text-sm mt-1">Step into the spotlight</p>
              </div>
              <input type="date" min={new Date().toISOString().split('T')[0]} value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="w-full px-4 py-3 bg-slate-800/60 border-2 border-cyan-400/40 rounded-lg text-white focus:outline-none focus:border-cyan-300 transition-all" />
              {dateError && <p className="text-pink-400 text-sm">{dateError}</p>}
              <button onClick={() => { if (!selectedDate) { setDateError('Please select a date'); return; } fetchAvailability(selectedDate); }}
                disabled={dateLoading}
                className="w-full bg-gradient-to-r from-cyan-400 to-pink-500 hover:from-cyan-300 hover:to-pink-400 disabled:opacity-50 text-slate-900 font-black py-3 rounded-lg shadow-lg shadow-cyan-400/40 transition-all">
                {dateLoading ? '🎤 Checking…' : '🎤 Check Availability'}
              </button>
            </div>
          )}

          {/* ── TIMELINE ── */}
          {step === 'timeline' && (
            <div className="space-y-5 relative z-10">
              <div>
                <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-300 to-violet-300">Choose Your Slot</h2>
                <p className="text-pink-300/50 text-sm mt-1">{selectedDate} · ₹{RATE.toLocaleString()}/hr</p>
              </div>

              {isBlackout ? (
                <div className="rounded-lg border border-pink-400/30 bg-pink-500/10 p-4 text-pink-200 text-sm">
                  🚫 This date is unavailable. Please choose another date.
                </div>
              ) : (
                <>
                  {/* Duration */}
                  <div>
                    <p className="text-slate-400 text-xs mb-2 font-semibold uppercase tracking-wider">How long?</p>
                    <div className="flex flex-wrap gap-2">
                      {DURATION_OPTS.map(opt => (
                        <button key={opt.value} onClick={() => { setSelectedDuration(opt.value); setSelectedStart(null); }}
                          className={`px-3 py-2 rounded-lg text-sm font-bold transition-all ${
                            selectedDuration === opt.value
                              ? 'bg-gradient-to-r from-cyan-400 to-cyan-600 text-slate-900 shadow-lg shadow-cyan-400/40 scale-105'
                              : 'bg-slate-800/60 border border-cyan-400/30 text-cyan-300 hover:border-cyan-300/60'}`}>
                          {opt.label}
                          <span className="block text-[10px] opacity-60">₹{(Math.ceil(opt.value / 60) * RATE).toLocaleString()}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Timeline bar */}
                  <div>
                    <p className="text-slate-400 text-xs mb-1 font-semibold uppercase tracking-wider">Tap to select start time</p>

                    {/* Hour labels */}
                    <div className="relative h-5 mb-1">
                      {hourLabels.map(min => (
                        <span key={min} className="absolute text-[10px] text-slate-500 -translate-x-1/2 whitespace-nowrap" style={{ left: pctL(min) }}>
                          {minutesToTime(min)}
                        </span>
                      ))}
                      <span className="absolute text-[10px] text-slate-500 -translate-x-full whitespace-nowrap" style={{ left: '100%' }}>
                        {minutesToTime(TL_END)}
                      </span>
                    </div>

                    {/* Clickable track */}
                    <div ref={timelineRef} onClick={handleTimelineClick}
                      className="relative h-16 bg-slate-800/60 border border-slate-700/50 rounded-lg cursor-crosshair overflow-hidden select-none">

                      {hourLabels.map(min => (
                        <div key={min} className="absolute top-0 h-full w-px bg-slate-600/30" style={{ left: pctL(min) }} />
                      ))}

                      {!selectedStart && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <span className="text-slate-600 text-xs">Tap anywhere to set start time</span>
                        </div>
                      )}

                      {/* Booked ranges */}
                      {bookedRanges.map((r, i) => {
                        const vs = Math.max(r.start, TL_START), ve = Math.min(r.end, TL_END);
                        if (ve <= vs) return null;
                        return (
                          <div key={i} className="absolute top-0 h-full bg-red-500/50 border-l border-r border-red-400/50 flex items-center justify-center"
                            style={{ left: pctL(vs), width: pctW(ve - vs) }}>
                            <span className="text-red-200 text-[9px] font-bold px-1 truncate">BOOKED</span>
                          </div>
                        );
                      })}

                      {/* Selected range */}
                      {selectedStart !== null && (
                        <div className={`absolute top-0 h-full border-l-2 border-r-2 transition-colors ${selectionValid ? 'bg-cyan-500/40 border-cyan-400' : 'bg-red-500/30 border-red-400'}`}
                          style={{ left: pctL(selectedStart), width: pctW(selectedDuration) }}>
                          <div className="h-full flex flex-col items-center justify-center px-1">
                            <span className={`text-[10px] font-black truncate ${selectionValid ? 'text-cyan-100' : 'text-red-200'}`}>{minutesToTime(selectedStart)}</span>
                            <span className={`text-[9px] truncate ${selectionValid ? 'text-cyan-300/60' : 'text-red-300/60'}`}>{fmtDuration(selectedDuration)}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-4 mt-2 text-[10px] text-slate-500">
                      <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-red-500/50 border border-red-400/50 inline-block" /> Booked</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-cyan-500/40 border border-cyan-400 inline-block" /> Your pick</span>
                    </div>
                  </div>

                  {/* Selection summary */}
                  {selectedStart !== null && (
                    <div className={`p-4 rounded-lg border ${selectionValid ? 'bg-cyan-500/10 border-cyan-400/30' : 'bg-red-500/10 border-red-400/40'}`}>
                      {selectionValid ? (
                        <>
                          <p className="text-white font-black text-lg">{minutesToTime(selectedStart)} – {minutesToTime(selectedStart + selectedDuration)}</p>
                          <p className="text-cyan-300/60 text-sm">{fmtDuration(selectedDuration)} · ₹{totalAmount.toLocaleString()}</p>
                        </>
                      ) : (
                        <p className="text-red-300 font-bold text-sm">⚠️ This time overlaps a booked session — tap a different spot.</p>
                      )}
                    </div>
                  )}
                </>
              )}

              <div className="flex gap-3">
                <button onClick={() => setStep('date')} className="flex-1 bg-slate-800/50 border border-slate-600 text-cyan-300 font-bold py-3 rounded-lg hover:border-slate-500 transition-all">Back</button>
                <button onClick={() => { if (selectionValid) setStep('form'); }} disabled={!selectionValid}
                  className="flex-1 bg-gradient-to-r from-pink-500 to-violet-500 hover:from-pink-400 hover:to-violet-400 disabled:opacity-40 text-white font-bold py-3 rounded-lg shadow-lg shadow-pink-400/40 transition-all">
                  Continue →
                </button>
              </div>
            </div>
          )}

          {/* ── FORM ── */}
          {step === 'form' && (
            <div className="space-y-5 relative z-10">
              {/* VIP */}
              <div className="bg-gradient-to-r from-yellow-500/15 via-green-500/15 to-cyan-500/15 border-2 border-yellow-400/40 rounded-xl p-4">
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-2xl">👑</span>
                  <div><h3 className="text-yellow-300 font-black">UNLOCK VIP PERKS</h3><p className="text-green-300/70 text-sm">Just ₹200 · Lifetime Access</p></div>
                </div>
                <div className="space-y-1 text-sm mb-3">
                  <div className="flex gap-2 text-cyan-200"><span>✨</span><span><strong>Triple Threat:</strong> Book 2 weekday hours, get 3rd FREE</span></div>
                  <div className="flex gap-2 text-yellow-200"><span>⭐</span><span><strong>Loyalty:</strong> Every 5 bookings = 1 FREE hour</span></div>
                  <div className="flex gap-2 text-green-200"><span>🎤</span><span>Priority booking access</span></div>
                </div>
                <button onClick={() => setFormData(p => ({ ...p, vipMember: !p.vipMember }))}
                  className={`text-sm font-bold px-4 py-2 rounded-lg transition-all ${formData.vipMember ? 'bg-gradient-to-r from-yellow-400 to-green-400 text-slate-900 shadow-lg shadow-yellow-400/40' : 'bg-slate-800/50 border border-yellow-400/40 text-yellow-300 hover:border-yellow-300'}`}>
                  {formData.vipMember ? '✓ VIP Added (+₹200)' : 'Become VIP'}
                </button>
              </div>

              <div>
                <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-300 to-cyan-300">Your Details</h2>
                <p className="text-pink-300/50 text-sm mt-1">Tell us who's singing</p>
              </div>

              <div className="space-y-3">
                <input type="text" placeholder="Full Name" value={formData.customerName} onChange={e => setFormData(p => ({ ...p, customerName: e.target.value }))} className="w-full px-4 py-3 bg-slate-800/60 border-2 border-pink-400/40 rounded-lg text-white placeholder-pink-300/30 focus:outline-none focus:border-pink-300 transition-all" />
                <input type="email" placeholder="Email Address" value={formData.customerEmail} onChange={e => setFormData(p => ({ ...p, customerEmail: e.target.value }))} className="w-full px-4 py-3 bg-slate-800/60 border-2 border-pink-400/40 rounded-lg text-white placeholder-pink-300/30 focus:outline-none focus:border-pink-300 transition-all" />
                <input type="tel" placeholder="Phone Number" value={formData.customerPhone} onChange={e => setFormData(p => ({ ...p, customerPhone: e.target.value }))} className="w-full px-4 py-3 bg-slate-800/60 border-2 border-pink-400/40 rounded-lg text-white placeholder-pink-300/30 focus:outline-none focus:border-pink-300 transition-all" />
                <div>
                  <label className="block text-pink-300/60 text-xs mb-1">Special Requests (Optional)</label>
                  <textarea
                    placeholder="e.g. birthday celebration setup, water bottles, snacks, any dietary needs or anything you'd like us to know..."
                    value={formData.specialRequests}
                    onChange={e => { if (e.target.value.length <= 500) setFormData(p => ({ ...p, specialRequests: e.target.value })); }}
                    rows={3}
                    maxLength={500}
                    className="w-full px-4 py-3 bg-slate-800/60 border-2 border-pink-400/40 rounded-lg text-white placeholder-pink-300/30 focus:outline-none focus:border-pink-300 transition-all resize-none text-sm"
                  />
                  <p className="text-pink-300/40 text-xs text-right mt-1">{formData.specialRequests.length}/500</p>
                </div>
              </div>

              {selectedStart !== null && (
                <div className="bg-slate-800/40 border border-pink-400/20 p-4 rounded-lg text-sm space-y-1">
                  <p className="text-white font-bold">{selectedDate} · {minutesToTime(selectedStart)} – {minutesToTime(selectedStart + selectedDuration)}</p>
                  <p className="text-slate-400">{fmtDuration(selectedDuration)} @ ₹{RATE.toLocaleString()}/hr</p>
                  {formData.vipMember && <p className="text-yellow-300">+ VIP Membership: ₹200</p>}
                  <p className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-pink-300">₹{(totalAmount + (formData.vipMember ? 200 : 0)).toLocaleString()}</p>
                </div>
              )}

              {confirmError && <p className="text-pink-400 text-sm">{confirmError}</p>}
              <div className="flex gap-3">
                <button onClick={() => { setConfirmError(''); setStep('timeline'); }} className="flex-1 bg-slate-800/50 border border-slate-600 text-cyan-300 font-bold py-3 rounded-lg hover:border-slate-500 transition-all">Back</button>
                <button onClick={() => {
                  if (!formData.customerName || !formData.customerEmail || !formData.customerPhone) { setConfirmError('Please fill in all required fields'); return; }
                  setConfirmError(''); setStep('payment');
                }} className="flex-1 bg-gradient-to-r from-pink-500 to-violet-500 hover:from-pink-400 hover:to-violet-400 text-white font-bold py-3 rounded-lg shadow-lg shadow-pink-400/40 transition-all">
                  Choose Payment →
                </button>
              </div>
            </div>
          )}

          {/* ── PAYMENT ── */}
          {step === 'payment' && selectedStart !== null && (
            <div className="space-y-5 relative z-10">
              <div>
                <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-violet-300">Choose Payment</h2>
                <p className="text-slate-400 text-sm mt-1">How would you like to pay?</p>
              </div>

              <div className="bg-slate-800/40 border border-cyan-400/20 p-4 rounded-lg space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-slate-400">Date</span><span className="text-white font-bold">{selectedDate}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Time</span><span className="text-white font-bold">{minutesToTime(selectedStart)} – {minutesToTime(selectedStart + selectedDuration)}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Duration</span><span className="text-white font-bold">{fmtDuration(selectedDuration)}</span></div>
                <div className="flex justify-between border-t border-slate-700/60 pt-2 mt-1">
                  <span className="text-slate-400">Total</span>
                  <span className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-violet-300">₹{totalAmount.toLocaleString()}</span>
                </div>
              </div>

              {/* Refund Policy */}
              <div className="bg-slate-800/40 border border-yellow-400/25 rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-base">📋</span>
                  <h3 className="text-yellow-300 font-black text-sm uppercase tracking-wider">Refund Policy</h3>
                </div>
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-white font-bold">₹500 Deposit (Non-Refundable)</p>
                    <p className="text-slate-400 mt-1">Your ₹500 deposit <span className="text-yellow-300 font-bold">LOCKS</span> your booking slot and is <span className="text-red-400 font-bold">NON-REFUNDABLE</span> under all circumstances — even if you cancel.</p>
                  </div>
                  <div>
                    <p className="text-white font-bold">Remaining Amount (Discretionary Refund)</p>
                    <p className="text-slate-400 mt-1">If you pay the full booking amount, the remaining balance will be refunded at admin discretion based on your cancellation reason:</p>
                    <ul className="mt-2 space-y-1 text-slate-400">
                      <li className="flex gap-2"><span className="text-red-400">✗</span><span>Same-day or no-show cancellation → No refund</span></li>
                      <li className="flex gap-2"><span className="text-yellow-300">◐</span><span>24+ hours advance notice → Refund at admin discretion</span></li>
                      <li className="flex gap-2"><span className="text-green-400">✓</span><span>Valid reason (emergency, illness, etc.) → Higher refund likelihood</span></li>
                    </ul>
                  </div>
                  <p className="text-slate-500 text-xs border-t border-slate-700/60 pt-3">By proceeding to payment, you agree to this policy.</p>
                </div>
              </div>

              <div className="border-2 border-cyan-400/40 rounded-xl p-5 bg-cyan-500/5 hover:border-cyan-300/60 transition-all">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xl">✅</span>
                  <div><h3 className="text-cyan-300 font-black text-lg">Full Pre-Payment</h3><p className="text-slate-400 text-sm">Nothing due at check-in</p></div>
                </div>
                <button onClick={() => handlePaymentChoice('full')} disabled={paymentChoiceLoading !== ''}
                  className="w-full bg-gradient-to-r from-cyan-400 to-cyan-600 hover:from-cyan-300 hover:to-cyan-500 disabled:opacity-50 text-slate-900 font-black py-3 rounded-lg shadow-lg shadow-cyan-400/30 text-lg transition-all">
                  {paymentChoiceLoading === 'full' ? 'Opening…' : `💳 Pay ₹${totalAmount.toLocaleString()} Now`}
                </button>
              </div>

              <div className="border-2 border-violet-400/40 rounded-xl p-5 bg-violet-500/5 hover:border-violet-300/60 transition-all">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xl">🔒</span>
                  <div><h3 className="text-violet-300 font-black text-lg">Reserve with Deposit</h3><p className="text-slate-400 text-sm">₹{DEPOSIT} now · ₹{(totalAmount - DEPOSIT).toLocaleString()} at check-in</p></div>
                </div>
                <p className="text-yellow-300/60 text-xs mb-3">⚠️ ₹{DEPOSIT} deposit is strictly non-refundable</p>
                <button onClick={() => handlePaymentChoice('deposit')} disabled={paymentChoiceLoading !== ''}
                  className="w-full bg-gradient-to-r from-violet-500 to-pink-500 hover:from-violet-400 hover:to-pink-400 disabled:opacity-50 text-white font-black py-3 rounded-lg shadow-lg shadow-violet-400/30 text-lg transition-all">
                  {paymentChoiceLoading === 'deposit' ? 'Opening…' : `🔒 Reserve with ₹${DEPOSIT} Deposit`}
                </button>
              </div>

              {confirmError && <p className="text-pink-400 text-sm">{confirmError}</p>}
              <button onClick={() => setStep('form')} disabled={paymentChoiceLoading !== ''}
                className="w-full bg-slate-800/50 border border-slate-600 text-cyan-300 font-bold py-3 rounded-lg hover:border-slate-500 disabled:opacity-50 transition-all">Back</button>
            </div>
          )}

          {/* ── CONFIRMATION ── */}
          {step === 'confirmation' && (
            <div className="text-center space-y-5 relative z-10">
              {bookingCancelled ? (
                <>
                  <div className="text-6xl">❌</div>
                  <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-300 to-red-300">Booking Cancelled</h2>
                  <p className="text-pink-300/60 text-sm">Your ₹{DEPOSIT} deposit has been forfeited.</p>
                  <div className="bg-pink-500/10 border border-pink-400/20 p-4 rounded-lg text-left">
                    <p className="text-slate-400 text-xs">Booking ID</p><p className="text-white font-mono font-bold text-sm">{bookingData.bookingId}</p>
                  </div>
                  <button onClick={resetAll} className="w-full bg-gradient-to-r from-violet-500 to-pink-500 text-white font-bold py-3 rounded-lg transition-all">Book Another Slot</button>
                </>
              ) : (
                <>
                  <div className="text-6xl">🎉</div>
                  <div>
                    <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-violet-300">You're In!</h2>
                    <p className="text-slate-400 text-sm">Your night is booked</p>
                  </div>
                  <div className="bg-cyan-500/10 border border-cyan-400/25 p-5 rounded-lg text-left space-y-3 text-sm">
                    <div><p className="text-slate-400 text-xs">Booking ID</p><p className="text-white font-mono font-bold">{bookingData.bookingId}</p></div>
                    <div><p className="text-slate-400 text-xs">Guest</p><p className="text-white font-bold">{formData.customerName}</p></div>
                    {selectedStart !== null && (
                      <div>
                        <p className="text-slate-400 text-xs">Session</p>
                        <p className="text-white font-bold">{selectedDate} · {minutesToTime(selectedStart)} – {minutesToTime(selectedStart + selectedDuration)}</p>
                        <p className="text-slate-500 text-xs">{fmtDuration(selectedDuration)}</p>
                      </div>
                    )}
                    {bookingData.paymentType === 'deposit' && bookingData.balanceDue > 0 && (
                      <div className="border-t border-cyan-400/20 pt-3">
                        <p className="text-yellow-300/60 text-xs">Balance due at check-in</p>
                        <p className="text-yellow-300 font-black text-xl">₹{bookingData.balanceDue.toLocaleString()}</p>
                      </div>
                    )}
                    {bookingData.paymentType === 'full' && (
                      <div className="border-t border-cyan-400/20 pt-3">
                        <p className="text-green-300 font-bold">✅ Fully paid — nothing due at check-in</p>
                      </div>
                    )}
                  </div>
                  <p className="text-slate-400 text-sm">Confirmation sent to <span className="text-white">{formData.customerEmail}</span></p>
                  {confirmError && <p className="text-pink-400 text-sm">{confirmError}</p>}
                  <button onClick={resetAll} className="w-full bg-gradient-to-r from-violet-500 to-pink-500 text-white font-bold py-3 rounded-lg transition-all">Book Another Slot</button>
                  <button onClick={handleCancelBooking} disabled={cancelLoading}
                    className="w-full bg-slate-800/50 border border-red-500/40 hover:border-red-400 text-red-400 hover:text-red-300 font-bold py-3 rounded-lg disabled:opacity-50 transition-all">
                    {cancelLoading ? 'Cancelling…' : 'Cancel Booking'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
