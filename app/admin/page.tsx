'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

const HOURLY_RATE = parseInt(process.env.NEXT_PUBLIC_HOURLY_RATE ?? '1180');
const HOURS_START = 12;
const HOURS_END = 22;

type AdminTab = 'bookings' | 'analytics';
type AnalyticsPeriod = 'today' | 'week' | 'month';

interface Booking {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  date: string;
  startHour?: number;
  hours: number;
  hourList?: string[];
  totalAmount: number;
  depositPaid: number;
  amountDue?: number;
  status: string;
  notes?: string;
  createdAt: any;
  checkInTime?: string;
  checkOutTime?: string;
}

interface OfflineForm {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  date: string;
  startHour: number;
  hours: number;
  amountPaid: number;
  notes: string;
}

interface AnalyticsData {
  totalRevenue: number;
  bookingsCount: number;
  pendingPayments: number;
  noShows: number;
  cancellations: number;
  dailyData: { date: string; revenue: number; count: number }[];
}

function fmtHour(h: number): string {
  if (h < 12) return `${h}:00 AM`;
  if (h === 12) return '12:00 PM';
  return `${h - 12}:00 PM`;
}

function fmtDate(d: string): string {
  return new Date(d + 'T12:00').toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

function bookingStartHour(b: Booking): number {
  return b.startHour ?? Number(b.hourList?.[0] ?? HOURS_START);
}

const HOUR_OPTS = Array.from({ length: HOURS_END - HOURS_START }, (_, i) => HOURS_START + i);

const EMPTY_FORM: OfflineForm = {
  customerName: '',
  customerPhone: '',
  customerEmail: '',
  date: '',
  startHour: 14,
  hours: 2,
  amountPaid: HOURLY_RATE * 2,
  notes: '',
};

const INPUT_CLS =
  'w-full px-3 py-2 bg-slate-800/60 border border-cyan-400/30 rounded-lg text-white placeholder-cyan-300/30 focus:outline-none focus:border-cyan-300 text-sm';
const LABEL_CLS = 'block text-cyan-300/70 text-xs mb-1';

const PERIOD_LABELS: Record<AnalyticsPeriod, string> = {
  today: 'Today',
  week: 'This Week',
  month: 'This Month',
};

export default function AdminDashboard() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [form, setForm] = useState<OfflineForm>({ ...EMPTY_FORM });
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [formBookings, setFormBookings] = useState<Booking[]>([]);

  const [activeTab, setActiveTab] = useState<AdminTab>('bookings');
  const [analyticsPeriod, setAnalyticsPeriod] = useState<AnalyticsPeriod>('week');
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

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
      const res = await fetch(`/api/admin/bookings?date=${date ?? selectedDate}`);
      const data = await res.json();
      if (data.success) setBookings(data.data);
      else setError('Failed to fetch bookings');
    } catch {
      setError('Error fetching bookings');
    } finally {
      setLoading(false);
    }
  };

  const fetchFormBookings = async (date: string) => {
    try {
      const res = await fetch(`/api/admin/bookings?date=${date}`);
      const data = await res.json();
      if (data.success) setFormBookings(data.data);
    } catch {}
  };

  const fetchAnalytics = async (period: AnalyticsPeriod = analyticsPeriod) => {
    setAnalyticsLoading(true);
    try {
      const res = await fetch(`/api/admin/analytics?period=${period}`);
      const data = await res.json();
      if (data.success) setAnalytics(data.data);
    } catch {}
    finally { setAnalyticsLoading(false); }
  };

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (showModal && form.date) fetchFormBookings(form.date);
  }, [showModal, form.date]);

  useEffect(() => {
    if (authenticated && activeTab === 'analytics') fetchAnalytics(analyticsPeriod);
  }, [authenticated, activeTab, analyticsPeriod]);

  const conflict = (() => {
    if (!showModal) return null;
    const slots = Array.from({ length: form.hours }, (_, i) => String(form.startHour + i));
    const hit = formBookings.find((b) => {
      if (b.id === editingBooking?.id) return false;
      if (['cancelled', 'completed'].includes(b.status)) return false;
      return (b.hourList ?? []).some((h) => slots.includes(h));
    });
    return hit ? `Slot taken by ${hit.customerName} (${fmtHour(bookingStartHour(hit))})` : null;
  })();

  const maxHours = Math.min(8, HOURS_END - form.startHour);
  const expectedTotal = HOURLY_RATE * form.hours;

  const setField = <K extends keyof OfflineForm>(k: K, v: OfflineForm[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const openCreate = () => {
    setEditingBooking(null);
    setForm({ ...EMPTY_FORM, date: selectedDate });
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (b: Booking) => {
    setEditingBooking(b);
    setForm({
      customerName: b.customerName,
      customerPhone: b.customerPhone,
      customerEmail: b.customerEmail ?? '',
      date: b.date,
      startHour: bookingStartHour(b),
      hours: b.hours,
      amountPaid: b.depositPaid,
      notes: b.notes ?? '',
    });
    setFormError('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingBooking(null);
    setFormBookings([]);
  };

  const handleSubmit = async () => {
    if (conflict) { setFormError(conflict); return; }
    if (!form.customerName.trim()) { setFormError('Guest name is required'); return; }
    if (!/^\d{10}$/.test(form.customerPhone.replace(/[^\d]/g, ''))) {
      setFormError('Enter a valid 10-digit phone number'); return;
    }
    if (!form.date) { setFormError('Date is required'); return; }

    setFormLoading(true);
    setFormError('');
    try {
      const payload = {
        ...form,
        startHour: Number(form.startHour),
        hours: Number(form.hours),
        amountPaid: Number(form.amountPaid),
        ...(editingBooking ? { bookingId: editingBooking.id } : {}),
      };
      const res = await fetch('/api/admin/bookings/manual', {
        method: editingBooking ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { setFormError(data.error ?? 'Failed to save booking'); return; }
      closeModal();
      if (form.date !== selectedDate) setSelectedDate(form.date);
      fetchBookings(form.date);
    } catch {
      setFormError('Network error. Please try again.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleCheckIn = async (bookingId: string) => {
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/checkin`, { method: 'POST' });
      const data = await res.json();
      if (data.success) fetchBookings();
      else setError('Check-in failed');
    } catch { setError('Error checking in'); }
  };

  const handleCheckOut = async (bookingId: string) => {
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/checkout`, { method: 'POST' });
      const data = await res.json();
      if (data.success) fetchBookings();
      else setError('Check-out failed');
    } catch { setError('Error checking out'); }
  };

  const handleCancel = async (bookingId: string) => {
    if (!confirm('Cancel this booking? Guest will be refunded.')) return;
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/cancel`, { method: 'POST' });
      const data = await res.json();
      if (data.success) fetchBookings();
      else setError('Cancellation failed');
    } catch { setError('Error cancelling booking'); }
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-slate-950 relative overflow-hidden flex items-center justify-center py-12 px-4">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-magenta-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>
        <div className="max-w-md w-full relative z-10">
          <div className="backdrop-blur-xl bg-slate-900/50 border border-cyan-400/30 rounded-2xl p-8 shadow-2xl shadow-cyan-400/20">
            <div className="text-center mb-8">
              <Image src="/logo.png" alt="Green Hills" width={80} height={80} className="mx-auto mb-4 opacity-90" />
              <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-magenta-300" style={{ textShadow: '0 0 20px rgba(0,217,255,0.4)' }}>
                ADMIN LOGIN
              </h1>
              <p className="text-cyan-300/70 text-sm mt-2">Prez Pu&apos; Control Room</p>
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
        <div className="absolute top-20 left-10 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-magenta-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-magenta-300" style={{ textShadow: '0 0 20px rgba(0,217,255,0.4)' }}>
              BOOKING CONTROL
            </h1>
            <p className="text-cyan-300/70 mt-1">Manage sessions</p>
          </div>
          <button
            onClick={() => setAuthenticated(false)}
            className="bg-slate-800/50 border border-slate-600 text-cyan-300 px-4 py-2 rounded-lg hover:border-slate-500"
          >
            🚪 Logout
          </button>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-2">
          {(['bookings', 'analytics'] as AdminTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-lg font-bold text-sm transition-all capitalize ${
                activeTab === tab
                  ? 'bg-gradient-to-r from-cyan-500 to-magenta-500 text-white shadow-lg shadow-cyan-500/30'
                  : 'bg-slate-800/50 border border-slate-600 text-cyan-300/70 hover:border-slate-500'
              }`}
            >
              {tab === 'bookings' ? '📋 Bookings' : '📊 Analytics'}
            </button>
          ))}
        </div>

        {/* ── Bookings Tab ── */}
        {activeTab === 'bookings' && (
          <>
            <div className="mb-8 flex flex-wrap gap-3 items-center">
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
              <button
                onClick={openCreate}
                className="ml-auto bg-gradient-to-r from-violet-500 to-cyan-500 hover:from-violet-400 hover:to-cyan-400 text-white px-5 py-2 rounded-lg font-bold shadow-lg shadow-violet-500/30"
              >
                + Create Offline Booking
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
                  bookings.map((booking) => {
                    const sh = bookingStartHour(booking);
                    return (
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
                            <p className="text-white font-bold">
                              {fmtHour(sh)} – {fmtHour(sh + booking.hours)}
                              <span className="text-cyan-300/60 font-normal ml-1">({booking.hours}h)</span>
                            </p>
                          </div>
                          <div>
                            <p className="text-cyan-300/70 text-sm">Amount</p>
                            <p className="text-magenta-300 font-bold">
                              ₹{booking.totalAmount}
                              {(booking.amountDue ?? 0) > 0 && (
                                <span className="text-yellow-400 text-xs ml-1">(due ₹{booking.amountDue})</span>
                              )}
                            </p>
                          </div>
                          <div>
                            <p className="text-cyan-300/70 text-sm">Status</p>
                            <p className={`font-bold text-sm ${
                              booking.status === 'confirmed' ? 'text-green-400' :
                              booking.status === 'checked_in' ? 'text-cyan-300' :
                              booking.status === 'completed' ? 'text-cyan-400' :
                              'text-yellow-400'
                            }`}>
                              {booking.status.toUpperCase()}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
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
                          {['confirmed', 'checked_in', 'pending_full_payment'].includes(booking.status) && (
                            <>
                              <button
                                onClick={() => openEdit(booking)}
                                className="bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-400 hover:to-purple-400 text-white px-4 py-2 rounded-lg font-bold text-sm"
                              >
                                ✏️ Edit
                              </button>
                              <button
                                onClick={() => handleCancel(booking.id)}
                                className="bg-gradient-to-r from-pink-500 to-red-500 hover:from-pink-400 hover:to-red-400 text-white px-4 py-2 rounded-lg font-bold text-sm"
                              >
                                ❌ Cancel
                              </button>
                            </>
                          )}
                        </div>

                        <div className="mt-4 pt-4 border-t border-slate-700/50 text-xs text-cyan-300/60 space-y-1">
                          <p>📧 {booking.customerEmail || '—'}</p>
                          <p>📱 {booking.customerPhone}</p>
                          {booking.notes && <p>📝 {booking.notes}</p>}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </>
        )}

        {/* ── Analytics Tab ── */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            {/* Period selector */}
            <div className="flex gap-2">
              {(['today', 'week', 'month'] as AnalyticsPeriod[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setAnalyticsPeriod(p)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${
                    analyticsPeriod === p
                      ? 'bg-cyan-500/30 border border-cyan-400/60 text-cyan-300'
                      : 'bg-slate-800/40 border border-slate-600/60 text-slate-400 hover:border-slate-500'
                  }`}
                >
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>

            {analyticsLoading ? (
              <div className="text-center text-cyan-300 py-16">Loading analytics...</div>
            ) : analytics ? (
              <>
                {/* Stat cards */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  <StatCard
                    label="Total Revenue"
                    value={`₹${analytics.totalRevenue.toLocaleString('en-IN')}`}
                    color="cyan"
                  />
                  <StatCard
                    label="Bookings"
                    value={String(analytics.bookingsCount)}
                    color="magenta"
                  />
                  <StatCard
                    label="Pending Payments"
                    value={`₹${analytics.pendingPayments.toLocaleString('en-IN')}`}
                    color="yellow"
                  />
                  <StatCard
                    label="No-shows"
                    value={String(analytics.noShows)}
                    color="red"
                  />
                  <StatCard
                    label="Cancellations"
                    value={String(analytics.cancellations)}
                    color="orange"
                  />
                </div>

                {/* Revenue chart */}
                {analytics.dailyData.length > 0 && mounted && (
                  <div className="backdrop-blur-xl bg-slate-900/40 border border-cyan-400/20 rounded-xl p-6">
                    <h3 className="text-cyan-300 font-bold mb-4 text-sm uppercase tracking-wider">
                      Revenue by Day
                    </h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={analytics.dailyData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.9} />
                            <stop offset="100%" stopColor="#a855f7" stopOpacity={0.5} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis
                          dataKey="date"
                          stroke="#67e8f9"
                          tick={{ fontSize: 11, fill: '#67e8f9' }}
                          tickFormatter={fmtDate}
                        />
                        <YAxis
                          stroke="#67e8f9"
                          tick={{ fontSize: 11, fill: '#67e8f9' }}
                          tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                          width={45}
                        />
                        <Tooltip
                          contentStyle={{
                            background: '#0f172a',
                            border: '1px solid rgba(34,211,238,0.3)',
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                          labelStyle={{ color: '#67e8f9' }}
                          labelFormatter={fmtDate as any}
                          formatter={((v: number) => [`₹${v.toLocaleString('en-IN')}`, 'Revenue']) as any}
                        />
                        <Bar dataKey="revenue" fill="url(#revenueGrad)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Bookings count chart */}
                {analytics.dailyData.length > 1 && mounted && (
                  <div className="backdrop-blur-xl bg-slate-900/40 border border-cyan-400/20 rounded-xl p-6">
                    <h3 className="text-cyan-300 font-bold mb-4 text-sm uppercase tracking-wider">
                      Bookings by Day
                    </h3>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={analytics.dailyData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="countGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#f472b6" stopOpacity={0.9} />
                            <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.5} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis
                          dataKey="date"
                          stroke="#f472b6"
                          tick={{ fontSize: 11, fill: '#f472b6' }}
                          tickFormatter={fmtDate}
                        />
                        <YAxis
                          stroke="#f472b6"
                          tick={{ fontSize: 11, fill: '#f472b6' }}
                          allowDecimals={false}
                          width={30}
                        />
                        <Tooltip
                          contentStyle={{
                            background: '#0f172a',
                            border: '1px solid rgba(244,114,182,0.3)',
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                          labelStyle={{ color: '#f472b6' }}
                          labelFormatter={fmtDate as any}
                          formatter={((v: number) => [v, 'Bookings']) as any}
                        />
                        <Bar dataKey="count" fill="url(#countGrad)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {analytics.dailyData.length === 0 && (
                  <div className="backdrop-blur-xl bg-slate-900/40 border border-cyan-400/20 rounded-xl p-8 text-center">
                    <p className="text-cyan-300/60">No bookings found for this period.</p>
                  </div>
                )}
              </>
            ) : null}
          </div>
        )}
      </div>

      {/* ── Offline Booking Modal ── */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto flex items-start justify-center bg-slate-950/80 backdrop-blur-sm py-8 px-4"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="w-full max-w-lg backdrop-blur-xl bg-slate-900/95 border border-cyan-400/30 rounded-2xl p-6 shadow-2xl shadow-cyan-400/20">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-violet-300">
                {editingBooking ? '✏️ Edit Booking' : '+ Offline Booking'}
              </h2>
              <button
                onClick={closeModal}
                className="text-cyan-300/60 hover:text-cyan-300 text-xl leading-none"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLS}>Guest Name *</label>
                  <input
                    type="text"
                    placeholder="Full name"
                    value={form.customerName}
                    onChange={(e) => setField('customerName', e.target.value)}
                    className={INPUT_CLS}
                  />
                </div>
                <div>
                  <label className={LABEL_CLS}>Phone *</label>
                  <input
                    type="tel"
                    placeholder="10-digit number"
                    value={form.customerPhone}
                    onChange={(e) => setField('customerPhone', e.target.value)}
                    className={INPUT_CLS}
                  />
                </div>
              </div>

              <div>
                <label className={LABEL_CLS}>Email</label>
                <input
                  type="email"
                  placeholder="guest@example.com"
                  value={form.customerEmail}
                  onChange={(e) => setField('customerEmail', e.target.value)}
                  className={INPUT_CLS}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLS}>Date *</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setField('date', e.target.value)}
                    className={INPUT_CLS}
                  />
                </div>
                <div>
                  <label className={LABEL_CLS}>Start Hour *</label>
                  <select
                    value={form.startHour}
                    onChange={(e) => {
                      const sh = Number(e.target.value);
                      const safeH = Math.min(form.hours, HOURS_END - sh);
                      setForm((p) => ({
                        ...p,
                        startHour: sh,
                        hours: safeH,
                        ...(!editingBooking ? { amountPaid: HOURLY_RATE * safeH } : {}),
                      }));
                    }}
                    className={INPUT_CLS}
                  >
                    {HOUR_OPTS.map((h) => (
                      <option key={h} value={h}>{fmtHour(h)}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLS}>Duration (hours) *</label>
                  <select
                    value={form.hours}
                    onChange={(e) => {
                      const h = Number(e.target.value);
                      setForm((p) => ({
                        ...p,
                        hours: h,
                        ...(!editingBooking ? { amountPaid: HOURLY_RATE * h } : {}),
                      }));
                    }}
                    className={INPUT_CLS}
                  >
                    {Array.from({ length: maxHours }, (_, i) => i + 1).map((h) => (
                      <option key={h} value={h}>{h} hour{h > 1 ? 's' : ''}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={LABEL_CLS}>
                    Amount Paid (₹)
                    <span className="text-cyan-300/40 ml-1">expected ₹{expectedTotal}</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={form.amountPaid}
                    onChange={(e) => setField('amountPaid', Number(e.target.value))}
                    className={INPUT_CLS}
                  />
                </div>
              </div>

              <div>
                <label className={LABEL_CLS}>Notes</label>
                <input
                  type="text"
                  placeholder="Any special requests…"
                  value={form.notes}
                  onChange={(e) => setField('notes', e.target.value)}
                  className={INPUT_CLS}
                />
              </div>

              {conflict && (
                <div className="p-3 bg-yellow-500/15 border border-yellow-400/40 rounded-lg text-yellow-300 text-sm">
                  ⚠️ {conflict}
                </div>
              )}

              {formError && (
                <div className="p-3 bg-pink-500/15 border border-pink-400/40 rounded-lg text-pink-300 text-sm">
                  {formError}
                </div>
              )}

              {form.date && (
                <div className="p-3 bg-slate-800/40 rounded-lg text-xs text-cyan-300/70 space-y-1">
                  <p>
                    📅 {form.date} &nbsp;·&nbsp;
                    ⏱ {fmtHour(form.startHour)} – {fmtHour(form.startHour + form.hours)} ({form.hours}h)
                  </p>
                  <p>
                    💰 Total ₹{expectedTotal} &nbsp;·&nbsp; Paid ₹{form.amountPaid} &nbsp;·&nbsp;
                    <span className={expectedTotal - form.amountPaid > 0 ? 'text-yellow-400' : 'text-green-400'}>
                      Due ₹{Math.max(0, expectedTotal - form.amountPaid)}
                    </span>
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  onClick={closeModal}
                  className="flex-1 py-2 bg-slate-800/60 border border-slate-600 text-cyan-300 rounded-lg hover:border-slate-500 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={formLoading || !!conflict}
                  className="flex-1 py-2 bg-gradient-to-r from-cyan-500 to-violet-500 hover:from-cyan-400 hover:to-violet-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg text-sm shadow-lg shadow-cyan-500/30"
                >
                  {formLoading
                    ? 'Saving…'
                    : editingBooking
                    ? 'Save Changes'
                    : 'Create Booking'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const COLOR_MAP = {
  cyan:    { border: 'border-cyan-400/30',   text: 'from-cyan-300 to-cyan-100' },
  magenta: { border: 'border-fuchsia-400/30', text: 'from-fuchsia-300 to-pink-200' },
  yellow:  { border: 'border-yellow-400/30', text: 'from-yellow-300 to-amber-200' },
  red:     { border: 'border-red-400/30',    text: 'from-red-300 to-rose-200' },
  orange:  { border: 'border-orange-400/30', text: 'from-orange-300 to-amber-200' },
};

function StatCard({ label, value, color }: { label: string; value: string; color: keyof typeof COLOR_MAP }) {
  const c = COLOR_MAP[color];
  return (
    <div className={`backdrop-blur-xl bg-slate-900/40 border ${c.border} rounded-xl p-5`}>
      <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">{label}</p>
      <p className={`text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r ${c.text}`}>
        {value}
      </p>
    </div>
  );
}
