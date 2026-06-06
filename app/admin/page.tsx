'use client';

import { useState } from 'react';
import Image from 'next/image';

interface Booking {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  date: string;
  hours: number;
  totalAmount: number;
  depositPaid: number;
  status: string;
  createdAt: any;
  checkInTime?: string;
  checkOutTime?: string;
}

export default function AdminDashboard() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const ADMIN_PASSWORD = 'GreenHills2021';

  const handleLogin = () => {
    if (password === ADMIN_PASSWORD) {
      setAuthenticated(true);
      setPassword('');
      fetchBookings();
    } else {
      setError('Invalid password');
    }
  };

  const fetchBookings = async (date?: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/bookings?date=${date || selectedDate}`);
      const data = await res.json();
      if (data.success) {
        setBookings(data.data);
      } else {
        setError('Failed to fetch bookings');
      }
    } catch (err) {
      setError('Error fetching bookings');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async (bookingId: string) => {
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/checkin`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        fetchBookings();
      } else {
        setError('Check-in failed');
      }
    } catch (err) {
      setError('Error checking in');
    }
  };

  const handleCheckOut = async (bookingId: string) => {
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/checkout`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        fetchBookings();
      } else {
        setError('Check-out failed');
      }
    } catch (err) {
      setError('Error checking out');
    }
  };

  const handleCancel = async (bookingId: string) => {
    if (!confirm('Cancel this booking? Guest will be refunded.')) return;
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/cancel`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        fetchBookings();
      } else {
        setError('Cancellation failed');
      }
    } catch (err) {
      setError('Error cancelling booking');
    }
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-slate-950 relative overflow-hidden flex items-center justify-center py-12 px-4">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-magenta-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        </div>

        <div className="max-w-md w-full relative z-10">
          <div className="backdrop-blur-xl bg-slate-900/50 border border-cyan-400/30 rounded-2xl p-8 shadow-2xl shadow-cyan-400/20">
            <div className="text-center mb-8">
              <Image src="/logo.png" alt="Green Hills" width={80} height={80} className="mx-auto mb-4 opacity-90" />
              <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-magenta-300" style={{ textShadow: '0 0 20px rgba(0,217,255,0.4)' }}>
                ADMIN LOGIN
              </h1>
              <p className="text-cyan-300/70 text-sm mt-2">Prez Pu' Control Room</p>
            </div>

            <div className="space-y-4">
              <input
                type="password"
                placeholder="Enter admin password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                className="w-full px-4 py-3 bg-slate-800/60 border-2 border-cyan-400/40 rounded-lg focus:outline-none focus:border-cyan-300 text-white placeholder-cyan-300/40"
              />
              {error && <p className="text-pink-400 text-sm">{error}</p>}
              <button
                onClick={handleLogin}
                className="w-full bg-gradient-to-r from-cyan-400 to-magenta-400 hover:from-cyan-300 hover:to-magenta-300 text-slate-900 font-black py-3 rounded-lg shadow-lg shadow-cyan-400/50"
              >
                🔓 Unlock Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 relative overflow-hidden py-12 px-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-magenta-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-magenta-300" style={{ textShadow: '0 0 20px rgba(0,217,255,0.4)' }}>
              BOOKING CONTROL
            </h1>
            <p className="text-cyan-300/70 mt-1">Manage today's sessions</p>
          </div>
          <button
            onClick={() => setAuthenticated(false)}
            className="bg-slate-800/50 border border-slate-600 text-cyan-300 px-4 py-2 rounded-lg hover:border-slate-500"
          >
            🚪 Logout
          </button>
        </div>

        <div className="mb-8 flex gap-4 items-center">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              fetchBookings(e.target.value);
            }}
            className="px-4 py-2 bg-slate-800/60 border-2 border-cyan-400/40 rounded-lg text-white focus:border-cyan-300"
          />
          <button
            onClick={() => fetchBookings()}
            className="bg-gradient-to-r from-cyan-500 to-magenta-500 text-white px-4 py-2 rounded-lg font-bold hover:from-cyan-400 hover:to-magenta-400"
          >
            🔄 Refresh
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-pink-500/20 border border-pink-400/40 rounded-lg text-pink-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center text-cyan-300">Loading bookings...</div>
        ) : (
          <div className="grid gap-4">
            {bookings.length === 0 ? (
              <div className="backdrop-blur-xl bg-slate-900/40 border border-cyan-400/20 rounded-xl p-8 text-center">
                <p className="text-cyan-300/70">No bookings for this date</p>
              </div>
            ) : (
              bookings.map((booking) => (
                <div
                  key={booking.id}
                  className="backdrop-blur-xl bg-slate-900/40 border border-cyan-400/20 rounded-xl p-6 hover:border-cyan-400/40 transition-all"
                >
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-cyan-300/70 text-sm">Guest</p>
                      <p className="text-white font-bold">{booking.customerName}</p>
                    </div>
                    <div>
                      <p className="text-cyan-300/70 text-sm">Time</p>
                      <p className="text-white font-bold">{booking.hours} hour(s)</p>
                    </div>
                    <div>
                      <p className="text-cyan-300/70 text-sm">Amount</p>
                      <p className="text-magenta-300 font-bold">₹{booking.totalAmount}</p>
                    </div>
                    <div>
                      <p className="text-cyan-300/70 text-sm">Status</p>
                      <p className={`font-bold text-sm ${
                        booking.status === 'confirmed' ? 'text-green-400' :
                        booking.status === 'completed' ? 'text-cyan-400' :
                        'text-yellow-400'
                      }`}>
                        {booking.status.toUpperCase()}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {booking.status === 'confirmed' && (
                      <button
                        onClick={() => handleCheckIn(booking.id)}
                        className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white px-4 py-2 rounded-lg font-bold text-sm"
                      >
                        ✅ Check In
                      </button>
                    )}
                    {booking.status === 'checked_in' && (
                      <button
                        onClick={() => handleCheckOut(booking.id)}
                        className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-white px-4 py-2 rounded-lg font-bold text-sm"
                      >
                        🏁 Check Out
                      </button>
                    )}
                    {['confirmed', 'checked_in'].includes(booking.status) && (
                      <button
                        onClick={() => handleCancel(booking.id)}
                        className="bg-gradient-to-r from-pink-500 to-red-500 hover:from-pink-400 hover:to-red-400 text-white px-4 py-2 rounded-lg font-bold text-sm"
                      >
                        ❌ Cancel
                      </button>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-700/50 text-xs text-cyan-300/60 space-y-1">
                    <p>📧 {booking.customerEmail}</p>
                    <p>📱 {booking.customerPhone}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
