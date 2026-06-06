'use client';

import { useState } from 'react';
import Image from 'next/image';

type BookingStep = 'date' | 'slots' | 'form' | 'payment' | 'confirmation';

interface Slot {
  hour: number;
  status: string;
  timeSlot: string;
}

interface Availability {
  date: string;
  slots: Slot[];
}

export default function BookingPage() {
  const [step, setStep] = useState<BookingStep>('date');
  const [selectedDate, setSelectedDate] = useState('');
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [selectedSlots, setSelectedSlots] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    vipMember: false,
  });

  const [bookingData, setBookingData] = useState({
    bookingId: '',
    razorpayOrderId: '',
    totalAmount: 0,
    depositAmount: 500,
  });

  const fetchAvailability = async (date: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/availability?date=${date}`);
      const data = await res.json();
      if (data.success) {
        setAvailability(data.data);
        setStep('slots');
      } else {
        setError(data.error || 'Failed to fetch availability');
      }
    } catch (err) {
      setError('Error fetching availability');
    } finally {
      setLoading(false);
    }
  };

  const toggleSlot = (hour: number) => {
    const newSelected = selectedSlots.includes(hour)
      ? selectedSlots.filter((h) => h !== hour)
      : [...selectedSlots, hour].sort((a, b) => a - b);
    setSelectedSlots(newSelected);
  };

  const isConsecutive = (slots: number[]): boolean => {
    if (slots.length === 0) return false;
    for (let i = 1; i < slots.length; i++) {
      if (slots[i] !== slots[i - 1] + 1) return false;
    }
    return true;
  };

  const handleBooking = async () => {
    if (!isConsecutive(selectedSlots)) {
      setError('Please select consecutive hours');
      return;
    }
    if (!formData.customerName || !formData.customerEmail || !formData.customerPhone) {
      setError('Please fill in all required fields');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/bookings/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          startHour: selectedSlots[0],
          hours: selectedSlots.length,
          customerName: formData.customerName,
          customerEmail: formData.customerEmail,
          customerPhone: formData.customerPhone,
        }),
      });
      const data = await res.json();
      if (data.success) {
        const totalAmount = 1180 * selectedSlots.length;
        setBookingData({
          bookingId: data.data.bookingId,
          razorpayOrderId: data.data.razorpayOrder?.id || '',
          totalAmount,
          depositAmount: 500,
        });
        setStep('payment');
      } else {
        setError(data.error || 'Booking failed');
      }
    } catch (err) {
      setError('Error initiating booking');
    } finally {
      setLoading(false);
    }
  };

  const initializePayment = async () => {
    const razorpayKey = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    if (!razorpayKey) {
      setError('Payment gateway not configured');
      return;
    }
    const options = {
      key: razorpayKey,
      order_id: bookingData.razorpayOrderId,
      amount: bookingData.depositAmount * 100,
      currency: 'INR',
      name: 'Green Hills Karaoke',
      description: `Booking for ${selectedDate} - ${selectedSlots.length} hour(s)`,
      handler: async (response: any) => {
        try {
          const res = await fetch('/api/webhooks/razorpay', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              bookingId: bookingData.bookingId,
            }),
          });
          const data = await res.json();
          if (data.success) {
            setStep('confirmation');
          } else {
            setError('Payment verification failed');
          }
        } catch (err) {
          setError('Payment verification error');
        }
      },
      prefill: {
        name: formData.customerName,
        email: formData.customerEmail,
        contact: formData.customerPhone,
      },
      theme: { color: '#00D9FF' },
    };
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => {
      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    };
    document.body.appendChild(script);
  };

  const getMinDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  return (
    <div className="min-h-screen bg-slate-950 relative overflow-hidden py-12 px-4">
      {/* Animated vibrant neon background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* Cyan pulse */}
        <div className="absolute top-20 left-10 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl animate-neon-vibe"></div>
        {/* Magenta pulse */}
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-magenta-500/20 rounded-full blur-3xl animate-neon-vibe" style={{ animationDelay: '0.5s' }}></div>
        {/* Pink pulse */}
        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-pink-500/15 rounded-full blur-3xl animate-neon-vibe" style={{ animationDelay: '1s' }}></div>
        {/* Green pulse (matching logo) */}
        <div className="absolute bottom-1/3 left-1/4 w-80 h-80 bg-green-500/15 rounded-full blur-3xl animate-neon-vibe" style={{ animationDelay: '1.5s' }}></div>
        {/* Extra cyan glow */}
        <div className="absolute top-1/3 right-1/4 w-72 h-72 bg-cyan-400/10 rounded-full blur-3xl animate-neon-vibe" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="max-w-2xl mx-auto relative z-10">
        {/* Header with Logo */}
        <div className="mb-12 text-center animate-in fade-in slide-in-from-top-8 duration-1000">
          <div className="mb-6 flex justify-center">
            <Image 
              src="/logo.png" 
              alt="Green Hills Karaoke" 
              width={120} 
              height={120}
              className="opacity-90 hover:opacity-100 transition-opacity drop-shadow-lg"
              style={{ filter: 'drop-shadow(0 0 20px rgba(34,197,94,0.4))' }}
            />
          </div>
          <div className="mb-4">
            <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-pink-300 to-magenta-300 drop-shadow-lg animate-text-glow" 
                style={{ textShadow: '0 0 40px rgba(0,217,255,0.6), 0 0 80px rgba(236,72,153,0.4), 0 0 120px rgba(139,92,246,0.2)' }}>
              GREEN HILLS
            </h1>
            <p className="text-2xl font-bold text-green-300 mt-1 animate-text-glow" style={{ textShadow: '0 0 30px rgba(34,197,94,0.8)' }}>
              KARAOKE
            </p>
          </div>
          <p className="text-lg text-cyan-300/90 animate-pulse">Reserve Your Night • Live Your Song</p>
        </div>

        {/* Step indicator */}
        <div className="mb-12 flex justify-center gap-3">
          {['date', 'slots', 'form', 'payment', 'confirmation'].map((s, i) => (
            <div
              key={s}
              className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                step === s
                  ? 'bg-gradient-to-r from-cyan-400 to-magenta-400 text-slate-900 shadow-lg shadow-cyan-400/70 scale-125 animate-pulse'
                  : ['date', 'slots', 'form'].includes(s) && ['slots', 'form', 'payment', 'confirmation'].includes(step)
                  ? 'bg-gradient-to-r from-cyan-500 to-pink-500 text-white shadow-lg shadow-pink-400/50'
                  : 'bg-slate-800 border border-slate-700 text-slate-400'
              }`}
            >
              {i + 1}
            </div>
          ))}
        </div>

        {/* Main Card */}
        <div className="backdrop-blur-xl bg-slate-900/50 border border-cyan-400/30 rounded-2xl p-8 shadow-2xl shadow-cyan-400/20 animate-in fade-in slide-in-from-bottom-8 duration-700 relative overflow-hidden">
          {/* Animated corner accent */}
          <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-cyan-500/20 to-transparent rounded-bl-full blur-2xl animate-neon-vibe"></div>
          
          {step === 'date' && (
            <div className="space-y-6 relative z-10">
              <div>
                <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-pink-300 mb-2 animate-text-glow" 
                    style={{ textShadow: '0 0 20px rgba(0,217,255,0.4)' }}>
                  Pick Your Date
                </h2>
                <p className="text-cyan-300/80">Step into the spotlight</p>
              </div>
              <input
                type="date"
                min={getMinDate()}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-4 py-3 bg-slate-800/60 border-2 border-cyan-400/40 rounded-lg focus:outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-400/30 text-white placeholder-cyan-300/40 transition-all shadow-lg shadow-cyan-400/10"
              />
              {error && <p className="text-pink-400 font-semibold">{error}</p>}
              <button
                onClick={() => {
                  if (!selectedDate) {
                    setError('Please select a date');
                    return;
                  }
                  fetchAvailability(selectedDate);
                }}
                disabled={loading}
                className="w-full bg-gradient-to-r from-cyan-400 to-magenta-400 hover:from-cyan-300 hover:to-magenta-300 disabled:opacity-50 text-slate-900 font-black py-3 rounded-lg transition-all shadow-lg shadow-cyan-400/60 hover:shadow-cyan-400/80 disabled:shadow-none"
              >
                {loading ? '🎤 Checking...' : '🎤 Check Availability'}
              </button>
            </div>
          )}

          {step === 'slots' && availability && (
            <div className="space-y-6 relative z-10">
              <div>
                <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-magenta-300 to-pink-300 mb-2 animate-text-glow" 
                    style={{ textShadow: '0 0 20px rgba(236,72,153,0.4)' }}>
                  Select Hours
                </h2>
                <p className="text-magenta-300/80">₹1,180 per hour • Pick consecutive slots</p>
              </div>
              {availability.slots.length === 0 ? (
                <div className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 p-4 text-cyan-100">
                  No available slots are open for this date yet. Please choose another day.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {availability.slots.map((slot) => (
                  <button
                    key={slot.hour}
                    onClick={() => toggleSlot(slot.hour)}
                    disabled={slot.status !== 'available' && !selectedSlots.includes(slot.hour)}
                    className={`p-4 rounded-lg font-bold transition-all text-sm ${
                      selectedSlots.includes(slot.hour)
                        ? 'bg-gradient-to-r from-cyan-400 to-magenta-400 text-slate-900 shadow-lg shadow-magenta-400/60 scale-105'
                        : slot.status === 'available'
                        ? 'bg-slate-800/60 border border-magenta-400/40 text-magenta-300 hover:border-magenta-300/80 hover:shadow-lg hover:shadow-magenta-400/30 transition-all'
                        : 'bg-slate-800/30 border border-slate-700 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    {slot.timeSlot}
                  </button>
                  ))}
                </div>
              )}
              {selectedSlots.length > 0 && (
                <div className="bg-gradient-to-r from-cyan-500/15 to-magenta-500/15 border border-magenta-400/30 p-4 rounded-lg shadow-lg shadow-magenta-400/10">
                  <p className="text-magenta-300 font-bold">
                    {selectedSlots.length} hour(s) • ₹{1180 * selectedSlots.length}
                  </p>
                </div>
              )}
              {error && <p className="text-pink-400 font-semibold">{error}</p>}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setStep('date');
                    setSelectedSlots([]);
                  }}
                  className="flex-1 bg-slate-800/50 border border-slate-600 hover:border-slate-500 text-cyan-300 font-bold py-3 rounded-lg transition-all"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep('form')}
                  disabled={selectedSlots.length === 0 || !isConsecutive(selectedSlots)}
                  className="flex-1 bg-gradient-to-r from-magenta-500 to-pink-500 hover:from-magenta-400 hover:to-pink-400 disabled:opacity-50 text-white font-bold py-3 rounded-lg transition-all shadow-lg shadow-magenta-400/60"
                >
                  Continue →
                </button>
              </div>
            </div>
          )}

          {step === 'form' && (
            <div className="space-y-6 relative z-10">
              <div className="bg-gradient-to-r from-yellow-500/20 via-green-500/20 to-cyan-500/20 border-2 border-yellow-400/50 rounded-xl p-5 relative overflow-hidden shadow-lg shadow-yellow-400/20">
                <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/10 to-green-500/10 animate-neon-vibe"></div>
                <div className="relative z-10">
                  <div className="flex items-start gap-3 mb-3">
                    <span className="text-2xl">👑</span>
                    <div>
                      <h3 className="text-yellow-300 font-black text-lg">UNLOCK VIP PERKS</h3>
                      <p className="text-green-300/90 text-sm">Just ₹200 • Lifetime Access</p>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm mb-4">
                    <div className="flex gap-2">
                      <span className="text-cyan-300">✨</span>
                      <span className="text-cyan-200"><strong>Triple Threat:</strong> Book 2 weekday hours, get 3rd FREE</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-yellow-300">⭐</span>
                      <span className="text-yellow-200"><strong>Loyalty Reward:</strong> Every 5 bookings = 1 FREE hour</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-green-300">🎤</span>
                      <span className="text-green-200"><strong>Exclusive Access:</strong> Priority slot booking</span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setFormData({ ...formData, vipMember: !formData.vipMember });
                    }}
                    className={`text-sm font-bold px-4 py-2 rounded-lg transition-all ${
                      formData.vipMember
                        ? 'bg-gradient-to-r from-yellow-400 to-green-400 text-slate-900 shadow-lg shadow-yellow-400/50'
                        : 'bg-slate-800/50 border border-yellow-400/40 text-yellow-300 hover:border-yellow-300/80 hover:shadow-lg hover:shadow-yellow-400/30'
                    }`}
                  >
                    {formData.vipMember ? '✓ VIP Added (+₹200)' : 'Become VIP'}
                  </button>
                </div>
              </div>

              <div>
                <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-300 to-cyan-300 mb-2 animate-text-glow" 
                    style={{ textShadow: '0 0 20px rgba(236,72,153,0.3)' }}>
                  Your Details
                </h2>
                <p className="text-pink-300/80">Tell us who's singing</p>
              </div>
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Full Name"
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-800/60 border-2 border-pink-400/40 rounded-lg focus:outline-none focus:border-pink-300 focus:ring-2 focus:ring-pink-400/30 text-white placeholder-pink-300/40 transition-all shadow-lg shadow-pink-400/10"
                />
                <input
                  type="email"
                  placeholder="Email Address"
                  value={formData.customerEmail}
                  onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-800/60 border-2 border-pink-400/40 rounded-lg focus:outline-none focus:border-pink-300 focus:ring-2 focus:ring-pink-400/30 text-white placeholder-pink-300/40 transition-all shadow-lg shadow-pink-400/10"
                />
                <input
                  type="tel"
                  placeholder="Phone Number"
                  value={formData.customerPhone}
                  onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-800/60 border-2 border-pink-400/40 rounded-lg focus:outline-none focus:border-pink-300 focus:ring-2 focus:ring-pink-400/30 text-white placeholder-pink-300/40 transition-all shadow-lg shadow-pink-400/10"
                />
              </div>
              <div className="bg-gradient-to-r from-cyan-500/15 to-pink-500/15 border border-pink-400/30 p-4 rounded-lg space-y-2 shadow-lg shadow-pink-400/10">
                <p className="text-pink-300/80 text-sm">Booking Summary</p>
                <p className="text-white font-bold">{selectedDate} • {selectedSlots.length} hour(s) @ ₹1,180</p>
                {formData.vipMember && <p className="text-yellow-300 text-sm">+ VIP Membership (one-time): ₹200</p>}
                <p className="text-cyan-300 text-sm">Deposit: ₹500 (non-refundable)</p>
                <p className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-magenta-300 animate-text-glow">
                  ₹{(1180 * selectedSlots.length) + (formData.vipMember ? 200 : 0)}
                </p>
              </div>
              {error && <p className="text-pink-400 font-semibold">{error}</p>}
              <div className="flex gap-3">
                <button
                  onClick={() => setStep('slots')}
                  className="flex-1 bg-slate-800/50 border border-slate-600 hover:border-slate-500 text-cyan-300 font-bold py-3 rounded-lg transition-all"
                >
                  Back
                </button>
                <button
                  onClick={handleBooking}
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-pink-500 to-magenta-500 hover:from-pink-400 hover:to-magenta-400 disabled:opacity-50 text-white font-bold py-3 rounded-lg transition-all shadow-lg shadow-pink-400/60"
                >
                  {loading ? 'Processing...' : 'Proceed to Payment'}
                </button>
              </div>
            </div>
          )}

          {step === 'payment' && (
            <div className="space-y-6 relative z-10">
              <div>
                <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-magenta-300 mb-2 animate-text-glow" 
                    style={{ textShadow: '0 0 20px rgba(0,217,255,0.4)' }}>
                  Secure Payment
                </h2>
                <p className="text-cyan-300/80">Complete your booking</p>
              </div>
              <div className="bg-gradient-to-r from-cyan-500/20 to-magenta-500/20 border border-cyan-400/40 p-6 rounded-lg space-y-3 shadow-lg shadow-cyan-400/20">
                <div className="flex justify-between text-sm">
                  <span className="text-cyan-300/80">Slot</span>
                  <span className="text-white font-bold">{selectedDate}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-cyan-300/80">Duration</span>
                  <span className="text-white font-bold">{selectedSlots.length} hour(s)</span>
                </div>
                <div className="border-t border-cyan-400/30 pt-3 flex justify-between">
                  <span className="text-cyan-300">Deposit</span>
                  <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-magenta-300">₹500</span>
                </div>
              </div>
              <p className="text-cyan-300/80 text-sm">Pay ₹500 now. Remaining ₹{1180 * selectedSlots.length - 500} at check-in.</p>
              <button
                onClick={initializePayment}
                className="w-full bg-gradient-to-r from-cyan-400 to-magenta-400 hover:from-cyan-300 hover:to-magenta-300 text-slate-900 font-black py-4 rounded-lg transition-all shadow-lg shadow-cyan-400/60 hover:shadow-cyan-400/80 text-lg"
              >
                💳 Pay ₹500 with Razorpay
              </button>
            </div>
          )}

          {step === 'confirmation' && (
            <div className="text-center space-y-6 relative z-10">
              <div className="text-6xl animate-in zoom-in duration-500">🎉</div>
              <div>
                <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-magenta-300 mb-2 animate-text-glow" 
                    style={{ textShadow: '0 0 20px rgba(0,217,255,0.4)' }}>
                  You're In!
                </h2>
                <p className="text-cyan-300/80">Your night is booked</p>
              </div>
              <div className="bg-gradient-to-r from-cyan-500/15 to-magenta-500/15 border border-cyan-400/30 p-6 rounded-lg text-left space-y-3 shadow-lg shadow-cyan-400/10">
                <div>
                  <p className="text-cyan-300/70 text-sm">Booking ID</p>
                  <p className="text-white font-mono font-bold">{bookingData.bookingId}</p>
                </div>
                <div>
                  <p className="text-cyan-300/70 text-sm">Guest</p>
                  <p className="text-white font-bold">{formData.customerName}</p>
                </div>
              </div>
              <p className="text-cyan-300/80">Confirmation sent to <span className="text-white font-bold">{formData.customerEmail}</span></p>
              <button
                onClick={() => {
                  setStep('date');
                  setSelectedDate('');
                  setSelectedSlots([]);
                  setFormData({ customerName: '', customerEmail: '', customerPhone: '', vipMember: false });
                  setAvailability(null);
                }}
                className="w-full bg-gradient-to-r from-magenta-500 to-pink-500 hover:from-magenta-400 hover:to-pink-400 text-white font-bold py-3 rounded-lg transition-all shadow-lg shadow-magenta-400/60"
              >
                Book Another Slot
              </button>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes neon-vibe {
          0%, 100% { 
            opacity: 0.3;
            transform: scale(1);
          }
          50% { 
            opacity: 0.8;
            transform: scale(1.1);
          }
        }
        @keyframes text-glow {
          0%, 100% {
            text-shadow: 0 0 20px rgba(0,217,255,0.4), 0 0 40px rgba(236,72,153,0.2);
          }
          50% {
            text-shadow: 0 0 30px rgba(0,217,255,0.6), 0 0 60px rgba(236,72,153,0.4), 0 0 90px rgba(139,92,246,0.3);
          }
        }
        .animate-neon-vibe {
          animation: neon-vibe 2.5s ease-in-out infinite;
        }
        .animate-text-glow {
          animation: text-glow 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
