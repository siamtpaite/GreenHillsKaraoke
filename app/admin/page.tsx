'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const HOURLY_RATE = parseInt(process.env.NEXT_PUBLIC_HOURLY_RATE ?? '1180');
const DEPOSIT_AMOUNT = parseInt(process.env.NEXT_PUBLIC_DEPOSIT_AMOUNT ?? '500');

// Admin timeline: 10 AM – midnight
const ADMIN_START = 600;   // 10:00
const ADMIN_END   = 1440;  // 24:00 (midnight)
const ADMIN_SPAN  = ADMIN_END - ADMIN_START;

type AdminTab = 'bookings' | 'analytics' | 'blackout' | 'refunds' | 'export';
type AnalyticsPeriod = 'today' | 'week' | 'month';

interface Booking {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  date: string;
  // New fields
  startTime?: number;
  duration?: number;
  endTime?: number;
  // Legacy fields (old bookings)
  startMinute?: number;
  startHour?: number;
  hours?: number;
  totalAmount: number;
  depositPaid: number;
  paidAmount?: number;
  amountDue?: number;
  balanceDue?: number;
  paymentType?: 'full' | 'deposit';
  status: string;
  notes?: string;
  specialRequests?: string;
  createdAt: any;
  checkInTime?: any;
  checkOutTime?: any;
  createdBy?: string;
}

interface OfflineForm {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  date: string;
  startTime: number;   // minutes from midnight
  duration: number;    // minutes
  amountPaid: number;
  specialRequests: string;
}

interface BlackoutDate { id: string; date: string; reason: string; createdBy: string; createdAt: any; }
interface PendingRefund {
  id: string;
  bookingId: string;
  razorpayPaymentId: string;
  razorpayOrderId?: string;
  customerName: string;
  customerPhone: string;
  reason: string;
  createdAt: string | null;
  resolved: boolean;
}
interface BlackoutForm { startDate: string; endDate: string; reason: string; }
interface AnalyticsData {
  totalRevenue: number; bookingsCount: number; pendingPayments: number;
  noShows: number; cancellations: number;
  dailyData: { date: string; revenue: number; count: number }[];
}

// Resolve start/end minutes from any booking format
function bookingStart(b: Booking): number {
  return b.startTime ?? b.startMinute ?? (b.startHour != null ? b.startHour * 60 : ADMIN_START);
}
function bookingDuration(b: Booking): number {
  return b.duration ?? (b.hours != null ? b.hours * 60 : 60);
}
function bookingEnd(b: Booking): number {
  return b.endTime ?? bookingStart(b) + bookingDuration(b);
}

function minutesToTime(min: number): string {
  if (min >= 1440) return '12:00 AM';
  const h = Math.floor(min / 60), m = min % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  const dh = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${dh}:${m.toString().padStart(2, '0')} ${period}`;
}

function fmtDuration(min: number): string {
  const h = Math.floor(min / 60), m = min % 60;
  if (m === 0) return `${h}h`;
  if (h === 0) return `${m}min`;
  return `${h}h ${m}min`;
}

function fmtDate(d: string): string {
  return new Date(d + 'T12:00').toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

// Generate 5-min time options for admin (10 AM to 11:55 PM, plus midnight)
const TIME_OPTS = [
  ...Array.from({ length: (1435 - ADMIN_START) / 5 + 1 }, (_, i) => ADMIN_START + i * 5),
  1440,
];

const DURATION_OPTS = [
  { label: '30 min', value: 30 }, { label: '1 hr', value: 60 },
  { label: '1.5 hr', value: 90 }, { label: '2 hr', value: 120 },
  { label: '2.5 hr', value: 150 }, { label: '3 hr', value: 180 },
  { label: '4 hr', value: 240 }, { label: '5 hr', value: 300 },
  { label: '6 hr', value: 360 },
];

const EMPTY_FORM: OfflineForm = {
  customerName: '', customerPhone: '', customerEmail: '',
  date: '', startTime: 14 * 60, duration: 120, amountPaid: 0, specialRequests: '',
};

const INPUT_CLS = 'w-full px-3 py-2 bg-slate-800/60 border border-cyan-400/30 rounded-lg text-white placeholder-cyan-300/30 focus:outline-none focus:border-cyan-300 text-sm';
const LABEL_CLS = 'block text-cyan-300/60 text-xs mb-1';
const PERIOD_LABELS: Record<AnalyticsPeriod, string> = { today: 'Today', week: 'This Week', month: 'This Month' };

// Timeline bar colors by status/paymentType
function bookingColor(b: Booking): { bg: string; border: string; text: string } {
  if (b.status === 'checked_in') return { bg: 'bg-blue-500/70', border: 'border-blue-400', text: 'text-blue-100' };
  if (b.status === 'confirmed' && b.paymentType === 'full') return { bg: 'bg-emerald-500/70', border: 'border-emerald-400', text: 'text-emerald-100' };
  if (b.status === 'confirmed') return { bg: 'bg-yellow-500/70', border: 'border-yellow-400', text: 'text-yellow-100' };
  if (b.status === 'completed') return { bg: 'bg-slate-500/50', border: 'border-slate-400', text: 'text-slate-300' };
  return { bg: 'bg-red-500/40', border: 'border-red-400/60', text: 'text-red-300' };
}

const pctL = (min: number) => `${((min - ADMIN_START) / ADMIN_SPAN * 100).toFixed(3)}%`;
const pctW = (dur: number) => `${(dur / ADMIN_SPAN * 100).toFixed(3)}%`;

export default function AdminDashboard() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [waResendLoading, setWaResendLoading] = useState(false);
  const [waResendResult, setWaResendResult] = useState<{ adminSent: boolean; customerSent: boolean } | null>(null);

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

  const [blackoutDates, setBlackoutDates] = useState<BlackoutDate[]>([]);
  const [blackoutLoading, setBlackoutLoading] = useState(false);
  const [blackoutForm, setBlackoutForm] = useState<BlackoutForm>({ startDate: '', endDate: '', reason: '' });
  const [blackoutSubmitting, setBlackoutSubmitting] = useState(false);
  const [blackoutError, setBlackoutError] = useState('');
  const [adminToken, setAdminToken] = useState('');
  const [pendingRefunds, setPendingRefunds] = useState<PendingRefund[]>([]);
  const [refundsLoading, setRefundsLoading] = useState(false);
  const [refundsError, setRefundsError] = useState('');

  const today = new Date().toISOString().split('T')[0];
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  const [exportStartDate, setExportStartDate] = useState(firstOfMonth);
  const [exportEndDate, setExportEndDate] = useState(today);
  const [exportLoading, setExportLoading] = useState<'' | 'csv' | 'pdf'>('');
  const [exportError, setExportError] = useState('');
  const [exportSuccess, setExportSuccess] = useState('');

  const handleExport = async (format: 'csv' | 'pdf') => {
    if (!exportStartDate || !exportEndDate) { setExportError('Please select both dates'); return; }
    setExportLoading(format); setExportError(''); setExportSuccess('');
    try {
      const res = await fetch(
        `/api/admin/export?startDate=${exportStartDate}&endDate=${exportEndDate}&format=${format}`,
        { headers: { 'x-admin-password': adminToken } }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setExportError(err.error || 'Export failed — please try again');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `GreenHills-Karaoke-Export-${exportStartDate}-to-${exportEndDate}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      setExportSuccess('Download started!');
      setTimeout(() => setExportSuccess(''), 4000);
    } catch { setExportError('Export failed — please try again'); }
    finally { setExportLoading(''); }
  };

  const handleLogin = async () => {
    if (!password.trim()) { setError('Enter admin password'); return; }
    try {
      const res = await fetch(`/api/admin/bookings?date=${selectedDate}`, {
        headers: { 'x-admin-password': password },
      });
      if (res.status === 401) { setError('Invalid password'); return; }
      const data = await res.json();
      if (data.success) {
        setAdminToken(password);
        setAuthenticated(true);
        setBookings(data.data);
      } else {
        setError('Authentication failed');
      }
    } catch { setError('Network error'); }
    setPassword('');
  };

  const fetchBookings = async (date?: string, token?: string) => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`/api/admin/bookings?date=${date ?? selectedDate}`, {
        headers: { 'x-admin-password': token ?? adminToken },
      });
      const data = await res.json();
      if (data.success) setBookings(data.data);
      else setError('Failed to fetch bookings');
    } catch { setError('Error fetching bookings'); }
    finally { setLoading(false); }
  };

  const fetchFormBookings = async (date: string) => {
    try {
      const res = await fetch(`/api/admin/bookings?date=${date}`, {
        headers: { 'x-admin-password': adminToken },
      });
      const data = await res.json();
      if (data.success) setFormBookings(data.data);
    } catch {}
  };

  const fetchBlackoutDates = async () => {
    setBlackoutLoading(true);
    try {
      const res = await fetch('/api/admin/blackout-dates', {
        headers: { 'x-admin-password': adminToken },
      });
      const data = await res.json();
      if (data.success) setBlackoutDates(data.data);
    } catch {}
    finally { setBlackoutLoading(false); }
  };

  const fetchAnalytics = async (period: AnalyticsPeriod = analyticsPeriod) => {
    setAnalyticsLoading(true);
    try {
      const res = await fetch(`/api/admin/analytics?period=${period}`, {
        headers: { 'x-admin-password': adminToken },
      });
      const data = await res.json();
      if (data.success) setAnalytics(data.data);
    } catch {}
    finally { setAnalyticsLoading(false); }
  };

  const expandDateRange = (start: string, end: string): string[] => {
    const dates: string[] = [];
    const cur = new Date(start + 'T12:00'), last = new Date(end + 'T12:00');
    while (cur <= last) { dates.push(cur.toISOString().split('T')[0]); cur.setDate(cur.getDate() + 1); }
    return dates;
  };

  const handleBlockDates = async () => {
    const { startDate, endDate, reason } = blackoutForm;
    if (!startDate) { setBlackoutError('Please select a date.'); return; }
    const effectiveEnd = endDate && endDate >= startDate ? endDate : startDate;
    const dates = expandDateRange(startDate, effectiveEnd).map(date => ({ date, reason }));
    setBlackoutSubmitting(true); setBlackoutError('');
    try {
      const res = await fetch('/api/admin/blackout-dates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': adminToken },
        body: JSON.stringify({ dates }),
      });
      const data = await res.json();
      if (!data.success) { setBlackoutError(data.error ?? 'Failed to block dates'); return; }
      setBlackoutForm({ startDate: '', endDate: '', reason: '' });
      fetchBlackoutDates();
    } catch { setBlackoutError('Network error. Please try again.'); }
    finally { setBlackoutSubmitting(false); }
  };

  const handleUnblockDate = async (date: string) => {
    if (!confirm(`Unblock ${fmtDate(date)}?`)) return;
    try {
      const res = await fetch(`/api/admin/blackout-dates/${date}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': adminToken },
      });
      const data = await res.json();
      if (data.success) fetchBlackoutDates(); else setBlackoutError(data.error ?? 'Failed to unblock date');
    } catch { setBlackoutError('Network error.'); }
  };

  const fetchPendingRefunds = async () => {
    setRefundsLoading(true); setRefundsError('');
    try {
      const res = await fetch('/api/admin/pending-refunds', { headers: { 'x-admin-password': adminToken } });
      const data = await res.json();
      if (data.success) setPendingRefunds(data.data);
      else setRefundsError(data.error || 'Failed to fetch');
    } catch { setRefundsError('Network error'); }
    finally { setRefundsLoading(false); }
  };

  const resolveRefund = async (paymentId: string) => {
    if (!confirm('Mark this refund as manually resolved?')) return;
    try {
      const res = await fetch('/api/admin/pending-refunds', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': adminToken },
        body: JSON.stringify({ paymentId }),
      });
      const data = await res.json();
      if (data.success) fetchPendingRefunds();
      else setRefundsError(data.error || 'Failed to resolve');
    } catch { setRefundsError('Network error'); }
  };

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (showModal && form.date) fetchFormBookings(form.date); }, [showModal, form.date]);
  useEffect(() => { if (authenticated && activeTab === 'analytics') fetchAnalytics(analyticsPeriod); }, [authenticated, activeTab, analyticsPeriod]);
  useEffect(() => { if (authenticated && activeTab === 'blackout') fetchBlackoutDates(); }, [authenticated, activeTab]);
  useEffect(() => { if (authenticated && activeTab === 'refunds') fetchPendingRefunds(); }, [authenticated, activeTab]);

  // Conflict detection: range overlap against other bookings on the same date
  const conflict = (() => {
    if (!showModal) return null;
    const propStart = form.startTime;
    const propEnd = form.startTime + form.duration;
    const hit = formBookings.find(b => {
      if (b.id === editingBooking?.id) return false;
      if (['cancelled', 'completed'].includes(b.status)) return false;
      const bStart = bookingStart(b), bEnd = bookingEnd(b);
      return propStart < bEnd && propEnd > bStart;
    });
    return hit ? `Slot taken by ${hit.customerName} (${minutesToTime(bookingStart(hit))})` : null;
  })();

  const expectedTotal = Math.ceil(form.duration / 60) * HOURLY_RATE;
  const setField = <K extends keyof OfflineForm>(k: K, v: OfflineForm[K]) => setForm(p => ({ ...p, [k]: v }));

  const openCreate = () => {
    setEditingBooking(null);
    setForm({ ...EMPTY_FORM, date: selectedDate });
    setFormError(''); setShowModal(true);
  };

  const openEdit = (b: Booking) => {
    setEditingBooking(b);
    setForm({
      customerName: b.customerName, customerPhone: b.customerPhone, customerEmail: b.customerEmail ?? '',
      date: b.date, startTime: bookingStart(b), duration: bookingDuration(b),
      amountPaid: b.paidAmount ?? b.depositPaid, specialRequests: b.specialRequests ?? b.notes ?? '',
    });
    setFormError(''); setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditingBooking(null); setFormBookings([]); };

  const handleSubmit = async () => {
    if (conflict) { setFormError(conflict); return; }
    if (!form.customerName.trim()) { setFormError('Guest name is required'); return; }
    if (!/^\d{10}$/.test(form.customerPhone.replace(/[^\d]/g, ''))) { setFormError('Enter a valid 10-digit phone number'); return; }
    if (!form.date) { setFormError('Date is required'); return; }
    setFormLoading(true); setFormError('');
    try {
      const payload = {
        ...form,
        startTime: Number(form.startTime),
        duration: Number(form.duration),
        amountPaid: Number(form.amountPaid),
        ...(editingBooking ? { bookingId: editingBooking.id } : {}),
      };
      const res = await fetch('/api/admin/bookings/manual', {
        method: editingBooking ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': adminToken },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { setFormError(data.error ?? 'Failed to save booking'); return; }
      closeModal();
      if (form.date !== selectedDate) setSelectedDate(form.date);
      fetchBookings(form.date);
    } catch { setFormError('Network error. Please try again.'); }
    finally { setFormLoading(false); }
  };

  const handleResendWa = async (bookingId: string) => {
    setWaResendLoading(true); setWaResendResult(null);
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/resend-wa`, {
        method: 'POST', headers: { 'x-admin-password': adminToken },
      });
      const data = await res.json();
      if (data.success) setWaResendResult(data.data);
      else setError(data.error || 'Failed to resend WA');
    } catch { setError('Error resending WA'); }
    finally { setWaResendLoading(false); }
  };

  const handleCheckIn = async (bookingId: string) => {
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/checkin`, {
        method: 'POST', headers: { 'x-admin-password': adminToken },
      });
      const data = await res.json();
      if (data.success) fetchBookings(); else setError('Check-in failed');
    } catch { setError('Error checking in'); }
  };

  const handleCheckOut = async (bookingId: string) => {
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/checkout`, {
        method: 'POST', headers: { 'x-admin-password': adminToken },
      });
      const data = await res.json();
      if (data.success) fetchBookings(); else setError('Check-out failed');
    } catch { setError('Error checking out'); }
  };

  const handleCancel = async (bookingId: string) => {
    if (!confirm(`⚠️ Cancel this booking? Guest loses ₹${DEPOSIT_AMOUNT} non-refundable deposit. Continue?`)) return;
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/cancel`, {
        method: 'POST', headers: { 'x-admin-password': adminToken },
      });
      const data = await res.json();
      if (data.success) { selectBooking(null); fetchBookings(); } else setError('Cancellation failed');
    } catch { setError('Error cancelling booking'); }
  };

  const selectBooking = (b: Booking | null) => { setSelectedBooking(b); setWaResendResult(null); };

  // Active bookings for the timeline
  const activeBookings = bookings.filter(b => !['cancelled'].includes(b.status));

  // Admin hour labels (10 AM to midnight)
  const adminHourLabels = Array.from({ length: 15 }, (_, i) => ADMIN_START + i * 60);

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center py-12 px-4 relative overflow-hidden">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>
        <div className="max-w-md w-full relative z-10">
          <div className="backdrop-blur-xl bg-slate-900/50 border border-cyan-400/30 rounded-2xl p-8 shadow-2xl shadow-cyan-400/20">
            <div className="text-center mb-8">
              <Image src="/logo.png" alt="Green Hills" width={80} height={80} className="mx-auto mb-4 opacity-90" />
              <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-pink-300" style={{ textShadow: '0 0 20px rgba(0,217,255,0.4)' }}>ADMIN LOGIN</h1>
              <p className="text-cyan-300/50 text-sm mt-2">Prez Pu&apos; Control Room</p>
            </div>
            <div className="space-y-4">
              <input type="password" placeholder="Enter admin password" value={password}
                onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()}
                className="w-full px-4 py-3 bg-slate-800/60 border-2 border-cyan-400/40 rounded-lg text-white placeholder-cyan-300/30 focus:outline-none focus:border-cyan-300" />
              {error && <p className="text-pink-400 text-sm">{error}</p>}
              <button onClick={handleLogin}
                className="w-full bg-gradient-to-r from-cyan-400 to-pink-500 hover:from-cyan-300 hover:to-pink-400 text-slate-900 font-black py-3 rounded-lg shadow-lg shadow-cyan-400/40">
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
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Image src="/logo.png" alt="Green Hills Karaoke" width={52} height={52} className="opacity-90 shrink-0" style={{ filter: 'drop-shadow(0 0 16px rgba(34,197,94,0.5))' }} />
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-pink-300">ADMIN CONTROL</h1>
            <p className="text-cyan-300/40 text-xs mt-0.5 uppercase tracking-widest">Green Hills Karaoke · Booking Dashboard</p>
          </div>
          <button onClick={() => setAuthenticated(false)}
            className="shrink-0 bg-slate-800/50 border border-slate-600 text-cyan-300/80 px-4 py-2 rounded-lg hover:border-cyan-500/50 hover:text-cyan-300 text-sm transition-all">
            🚪 Logout
          </button>
        </div>

        {/* Main card */}
        <div className="backdrop-blur-xl bg-slate-900/40 border border-cyan-400/20 rounded-2xl shadow-2xl shadow-cyan-400/5">
          {/* Tabs */}
          <div className="flex gap-2 flex-wrap px-5 pt-5 pb-4 border-b border-slate-700/50">
            {(['bookings','analytics','blackout','refunds','export'] as AdminTab[]).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-5 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === tab ? 'bg-gradient-to-r from-cyan-500 to-pink-500 text-white shadow-lg shadow-cyan-500/30' : 'bg-slate-800/50 border border-slate-600/60 text-cyan-300/70 hover:border-slate-500 hover:text-cyan-300'}`}>
                {tab === 'bookings' ? '📋 Bookings' : tab === 'analytics' ? '📊 Analytics' : tab === 'blackout' ? '🚫 Blackout Dates' : tab === 'refunds' ? '💸 Pending Refunds' : '📤 Export'}
              </button>
            ))}
          </div>

          <div className="p-5">

        {/* ── BOOKINGS TAB ── */}
        {activeTab === 'bookings' && (
          <>
            <div className="mb-6 flex flex-wrap gap-3 items-center">
              <input type="date" value={selectedDate}
                onChange={e => { setSelectedDate(e.target.value); fetchBookings(e.target.value); }}
                className="px-4 py-2 bg-slate-800/60 border-2 border-cyan-400/40 rounded-lg text-white focus:border-cyan-300 text-sm" />
              <button onClick={() => fetchBookings()}
                className="bg-gradient-to-r from-cyan-500 to-pink-500 text-white px-4 py-2 rounded-lg font-bold text-sm hover:from-cyan-400 hover:to-pink-400">
                🔄 Refresh
              </button>
              <button onClick={openCreate}
                className="ml-auto bg-gradient-to-r from-violet-500 to-cyan-500 hover:from-violet-400 hover:to-cyan-400 text-white px-5 py-2 rounded-lg font-bold text-sm shadow-lg shadow-violet-500/30">
                + Create Offline Booking
              </button>
            </div>

            {error && <div className="mb-4 p-3 bg-pink-500/20 border border-pink-400/40 rounded-lg text-pink-300 text-sm">{error}</div>}

            {/* Visual Timeline */}
            {!loading && activeBookings.length > 0 && (
              <div className="mb-6 backdrop-blur-xl bg-slate-900/40 border border-cyan-400/20 rounded-xl p-5">
                <h3 className="text-cyan-300/70 text-xs font-bold uppercase tracking-wider mb-3">Timeline — {selectedDate}</h3>

                {/* Hour labels */}
                <div className="relative h-5 mb-1">
                  {adminHourLabels.map(min => (
                    <span key={min} className="absolute text-[9px] text-slate-500 -translate-x-1/2 whitespace-nowrap" style={{ left: pctL(min) }}>
                      {minutesToTime(min)}
                    </span>
                  ))}
                </div>

                {/* Timeline bar */}
                <div className="relative h-12 bg-slate-800/60 border border-slate-700/40 rounded-lg overflow-hidden">
                  {/* Hour tick lines */}
                  {adminHourLabels.map(min => (
                    <div key={min} className="absolute top-0 h-full w-px bg-slate-600/30" style={{ left: pctL(min) }} />
                  ))}

                  {/* Booking bars */}
                  {activeBookings.map(b => {
                    const bStart = bookingStart(b), bEnd = bookingEnd(b);
                    const visStart = Math.max(bStart, ADMIN_START), visEnd = Math.min(bEnd, ADMIN_END);
                    if (visEnd <= visStart) return null;
                    const colors = bookingColor(b);
                    return (
                      <button key={b.id}
                        onClick={() => selectBooking(selectedBooking?.id === b.id ? null : b)}
                        className={`absolute top-0 h-full ${colors.bg} border-l-2 border-r ${colors.border} flex items-center px-1 hover:brightness-110 transition-all ${selectedBooking?.id === b.id ? 'ring-2 ring-white/40' : ''}`}
                        style={{ left: pctL(visStart), width: pctW(visEnd - visStart) }}
                        title={`${b.customerName} · ${minutesToTime(bStart)} – ${minutesToTime(bEnd)}`}>
                        <span className={`text-[9px] font-bold truncate ${colors.text}`}>{b.customerName}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-3 mt-2 text-[10px] text-slate-500">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500/70 inline-block" /> Full payment</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-yellow-500/70 inline-block" /> Deposit only</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-500/70 inline-block" /> Checked in</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-slate-500/60 inline-block" /> Completed</span>
                </div>
              </div>
            )}

            {/* Selected booking detail panel */}
            {selectedBooking && (
              <div className="mb-4 backdrop-blur-xl bg-slate-900/40 border border-violet-400/30 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-violet-300 font-black">{selectedBooking.customerName}</h3>
                    {selectedBooking.createdBy === 'admin' && (
                      <span className="px-2 py-0.5 bg-amber-500/20 border border-amber-400/40 rounded text-amber-300 text-xs font-bold">📵 OFFLINE</span>
                    )}
                  </div>
                  <button onClick={() => selectBooking(null)} className="text-slate-400 hover:text-white text-lg">✕</button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-4">
                  <div><p className="text-slate-400 text-xs">Time</p>
                    <p className="text-white font-bold">{minutesToTime(bookingStart(selectedBooking))} – {minutesToTime(bookingEnd(selectedBooking))}</p></div>
                  <div><p className="text-slate-400 text-xs">Duration</p>
                    <p className="text-white font-bold">{fmtDuration(bookingDuration(selectedBooking))}</p></div>
                  <div><p className="text-slate-400 text-xs">Amount</p>
                    <p className="text-white font-bold">₹{selectedBooking.totalAmount}
                      {(selectedBooking.balanceDue ?? selectedBooking.amountDue ?? 0) > 0 && (
                        <span className="text-yellow-400 text-xs ml-1">(due ₹{selectedBooking.balanceDue ?? selectedBooking.amountDue})</span>
                      )}
                    </p></div>
                  <div><p className="text-slate-400 text-xs">Status</p>
                    <p className={`font-bold text-sm ${selectedBooking.status === 'confirmed' ? 'text-green-400' : selectedBooking.status === 'checked_in' ? 'text-blue-400' : selectedBooking.status === 'completed' ? 'text-cyan-400' : 'text-yellow-400'}`}>
                      {selectedBooking.status.toUpperCase()}
                    </p></div>
                </div>
                <div className="text-xs text-slate-400 mb-3 space-y-1">
                  <p>📱 {selectedBooking.customerPhone}</p>
                  <p>📧 {selectedBooking.customerEmail || '—'}</p>
                </div>
                {(selectedBooking.specialRequests || selectedBooking.notes) && (
                  <div className="mb-3 px-3 py-2 bg-amber-500/15 border border-amber-400/30 rounded-lg">
                    <p className="text-amber-300 text-xs font-semibold">📝 Special Requests: {selectedBooking.specialRequests || selectedBooking.notes}</p>
                  </div>
                )}
                {waResendResult && (
                  <div className="mb-3 px-3 py-2 bg-slate-800/60 border border-slate-600/60 rounded-lg text-xs space-y-0.5">
                    <p className={waResendResult.adminSent ? 'text-green-400' : 'text-red-400'}>
                      {waResendResult.adminSent ? '✓ Admin WA sent' : '✗ Admin WA failed'}
                    </p>
                    <p className={waResendResult.customerSent ? 'text-green-400' : 'text-red-400'}>
                      {waResendResult.customerSent ? '✓ Customer WA sent' : '✗ Customer WA failed'}
                    </p>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {selectedBooking.status === 'confirmed' && (
                    <button onClick={() => handleCheckIn(selectedBooking.id)}
                      className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white px-4 py-2 rounded-lg font-bold text-sm">
                      ✅ Check In
                    </button>
                  )}
                  {selectedBooking.status === 'checked_in' && (
                    <button onClick={() => handleCheckOut(selectedBooking.id)}
                      className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-4 py-2 rounded-lg font-bold text-sm">
                      🏁 Check Out
                    </button>
                  )}
                  {['confirmed', 'checked_in'].includes(selectedBooking.status) && (
                    <>
                      <button onClick={() => openEdit(selectedBooking)}
                        className="bg-gradient-to-r from-violet-500 to-purple-500 text-white px-4 py-2 rounded-lg font-bold text-sm">
                        ✏️ Edit
                      </button>
                      <button onClick={() => handleCancel(selectedBooking.id)}
                        className="bg-gradient-to-r from-pink-500 to-red-500 text-white px-4 py-2 rounded-lg font-bold text-sm">
                        ❌ Cancel
                      </button>
                    </>
                  )}
                  <button onClick={() => handleResendWa(selectedBooking.id)} disabled={waResendLoading}
                    className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 border border-slate-500 text-cyan-300 px-4 py-2 rounded-lg font-bold text-sm transition-all">
                    {waResendLoading ? '⏳ Sending…' : '📲 Resend WA'}
                  </button>
                </div>
              </div>
            )}

            {loading ? (
              <div className="text-center text-cyan-300 text-sm py-8">Loading bookings…</div>
            ) : (
              <div className="grid gap-3">
                {bookings.length === 0 ? (
                  <div className="backdrop-blur-xl bg-slate-900/40 border border-cyan-400/20 rounded-xl p-8 text-center">
                    <p className="text-cyan-300/50 text-sm">No bookings for this date</p>
                  </div>
                ) : (
                  bookings.map(booking => {
                    const bStart = bookingStart(booking), bEnd = bookingEnd(booking);
                    return (
                      <div key={booking.id}
                        className={`backdrop-blur-xl bg-slate-900/40 border rounded-xl p-5 hover:border-cyan-400/40 transition-all cursor-pointer ${selectedBooking?.id === booking.id ? 'border-violet-400/50' : 'border-cyan-400/20'}`}
                        onClick={() => selectBooking(selectedBooking?.id === booking.id ? null : booking)}>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div><p className="text-slate-400 text-xs">Guest</p><p className="text-white font-bold">{booking.customerName}</p></div>
                          <div><p className="text-slate-400 text-xs">Time</p>
                            <p className="text-white font-bold">{minutesToTime(bStart)} – {minutesToTime(bEnd)}<span className="text-slate-500 font-normal ml-1">({fmtDuration(bookingDuration(booking))})</span></p></div>
                          <div><p className="text-slate-400 text-xs">Amount</p>
                            <p className="text-pink-300 font-bold">₹{booking.totalAmount}
                              {(booking.balanceDue ?? booking.amountDue ?? 0) > 0 && <span className="text-yellow-400 text-xs ml-1">(due ₹{booking.balanceDue ?? booking.amountDue})</span>}
                            </p></div>
                          <div><p className="text-slate-400 text-xs">Status</p>
                            <p className={`font-bold text-sm ${booking.status === 'confirmed' ? 'text-green-400' : booking.status === 'checked_in' ? 'text-blue-400' : booking.status === 'completed' ? 'text-cyan-400' : 'text-yellow-400'}`}>
                              {booking.status.toUpperCase()}
                            </p></div>
                        </div>
                        {(booking.specialRequests || booking.notes) && (
                          <div className="mt-2 px-3 py-2 bg-amber-500/15 border border-amber-400/30 rounded-lg">
                            <p className="text-amber-300 text-xs font-semibold">📝 Special Requests: {booking.specialRequests || booking.notes}</p>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </>
        )}

        {/* ── ANALYTICS TAB ── */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="flex gap-2">
              {(['today','week','month'] as AnalyticsPeriod[]).map(p => (
                <button key={p} onClick={() => setAnalyticsPeriod(p)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${analyticsPeriod === p ? 'bg-cyan-500/30 border border-cyan-400/60 text-cyan-300' : 'bg-slate-800/40 border border-slate-600/60 text-slate-400 hover:border-slate-500'}`}>
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>
            {analyticsLoading ? (
              <div className="text-center text-cyan-300 py-16 text-sm">Loading analytics…</div>
            ) : analytics ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {[
                    { label: 'Total Revenue', value: `₹${analytics.totalRevenue.toLocaleString('en-IN')}`, color: 'cyan' as const },
                    { label: 'Bookings', value: String(analytics.bookingsCount), color: 'magenta' as const },
                    { label: 'Pending Payments', value: `₹${analytics.pendingPayments.toLocaleString('en-IN')}`, color: 'yellow' as const },
                    { label: 'No-shows', value: String(analytics.noShows), color: 'red' as const },
                    { label: 'Cancellations', value: String(analytics.cancellations), color: 'orange' as const },
                  ].map(c => <StatCard key={c.label} {...c} />)}
                </div>
                {analytics.dailyData.length > 0 && mounted && (
                  <div className="backdrop-blur-xl bg-slate-900/40 border border-cyan-400/20 rounded-xl p-6">
                    <h3 className="text-cyan-300 font-bold mb-4 text-sm uppercase tracking-wider">Revenue by Day</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={analytics.dailyData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                        <defs><linearGradient id="rg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22d3ee" stopOpacity={0.9} /><stop offset="100%" stopColor="#a855f7" stopOpacity={0.5} /></linearGradient></defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="date" stroke="#67e8f9" tick={{ fontSize: 11, fill: '#67e8f9' }} tickFormatter={fmtDate} />
                        <YAxis stroke="#67e8f9" tick={{ fontSize: 11, fill: '#67e8f9' }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} width={45} />
                        <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(34,211,238,0.3)', borderRadius: 8, fontSize: 12 }}
                          labelStyle={{ color: '#67e8f9' }} labelFormatter={fmtDate as any}
                          formatter={((v: number) => [`₹${v.toLocaleString('en-IN')}`, 'Revenue']) as any} />
                        <Bar dataKey="revenue" fill="url(#rg)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </>
            ) : null}
          </div>
        )}

        {/* ── BLACKOUT TAB ── */}
        {activeTab === 'blackout' && (
          <div className="space-y-6">
            <div className="backdrop-blur-xl bg-slate-900/40 border border-pink-400/20 rounded-xl p-6 space-y-4">
              <h3 className="text-pink-300 font-black text-lg">Block Date(s)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className={LABEL_CLS}>From *</label>
                  <input type="date" value={blackoutForm.startDate}
                    onChange={e => setBlackoutForm(p => ({ ...p, startDate: e.target.value, endDate: p.endDate || e.target.value }))}
                    className={INPUT_CLS} /></div>
                <div><label className={LABEL_CLS}>To (same for single date)</label>
                  <input type="date" value={blackoutForm.endDate} min={blackoutForm.startDate}
                    onChange={e => setBlackoutForm(p => ({ ...p, endDate: e.target.value }))}
                    className={INPUT_CLS} /></div>
              </div>
              <div><label className={LABEL_CLS}>Reason</label>
                <input type="text" placeholder="e.g. Maintenance, Holiday…" value={blackoutForm.reason}
                  onChange={e => setBlackoutForm(p => ({ ...p, reason: e.target.value }))} className={INPUT_CLS} /></div>
              {blackoutError && <p className="text-pink-400 text-sm">{blackoutError}</p>}
              <button onClick={handleBlockDates} disabled={blackoutSubmitting || !blackoutForm.startDate}
                className="bg-gradient-to-r from-pink-500 to-red-500 hover:from-pink-400 hover:to-red-400 disabled:opacity-50 text-white font-black px-6 py-2 rounded-lg text-sm">
                {blackoutSubmitting ? 'Blocking…' : '🚫 Block Date(s)'}
              </button>
            </div>
            <div className="space-y-3">
              <h3 className="text-cyan-300/60 text-xs uppercase tracking-wider font-bold">Active Blackout Dates ({blackoutDates.length})</h3>
              {blackoutLoading ? <p className="text-cyan-300/50 text-sm">Loading…</p> :
                blackoutDates.length === 0 ? (
                  <div className="backdrop-blur-xl bg-slate-900/40 border border-cyan-400/20 rounded-xl p-6 text-center">
                    <p className="text-cyan-300/40 text-sm">No blackout dates set.</p>
                  </div>
                ) : blackoutDates.map(bd => (
                  <div key={bd.id} className="backdrop-blur-xl bg-slate-900/40 border border-pink-400/20 rounded-xl px-5 py-4 flex items-center justify-between gap-4">
                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                      <span className="text-white font-bold">{new Date(bd.date + 'T12:00').toLocaleDateString('en-IN', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</span>
                      <span className="text-pink-300">{bd.reason}</span>
                      <span className="text-slate-400 text-xs self-center">by {bd.createdBy ?? 'admin'}</span>
                    </div>
                    <button onClick={() => handleUnblockDate(bd.date)}
                      className="shrink-0 bg-slate-800/60 border border-slate-600 hover:border-green-500/60 hover:text-green-400 text-slate-300 text-xs font-bold px-3 py-1.5 rounded-lg transition-all">
                      ✓ Unblock
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ── PENDING REFUNDS TAB ── */}
        {activeTab === 'refunds' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-pink-300 font-black text-lg">💸 Pending Refunds</h3>
              <button onClick={fetchPendingRefunds} disabled={refundsLoading}
                className="bg-slate-800/50 border border-slate-600/60 text-cyan-300/70 hover:text-cyan-300 text-xs font-bold px-3 py-1.5 rounded-lg transition-all">
                {refundsLoading ? 'Loading…' : '🔄 Refresh'}
              </button>
            </div>
            {refundsError && <p className="text-pink-400 text-sm">{refundsError}</p>}
            {!refundsLoading && pendingRefunds.length === 0 && (
              <div className="backdrop-blur-xl bg-slate-900/40 border border-cyan-400/20 rounded-xl p-8 text-center">
                <p className="text-green-400 font-bold">✅ No pending refunds</p>
                <p className="text-slate-500 text-sm mt-1">All Razorpay refunds processed successfully.</p>
              </div>
            )}
            {pendingRefunds.map((r) => (
              <div key={r.id} className="backdrop-blur-xl bg-slate-900/40 border border-red-400/30 rounded-xl p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 flex-1 min-w-0">
                    <p className="text-white font-bold text-sm truncate">{r.customerName} · {r.customerPhone}</p>
                    <p className="text-slate-400 text-xs font-mono">Payment: {r.razorpayPaymentId}</p>
                    <p className="text-slate-400 text-xs font-mono">Booking: {r.bookingId}</p>
                    <p className="text-pink-300/80 text-xs">{r.reason}</p>
                    {r.createdAt && <p className="text-slate-500 text-xs">{new Date(r.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>}
                  </div>
                  <button onClick={() => resolveRefund(r.id)}
                    className="shrink-0 bg-emerald-500/20 border border-emerald-500/40 hover:bg-emerald-500/30 text-emerald-300 text-xs font-bold px-3 py-1.5 rounded-lg transition-all">
                    ✓ Resolved
                  </button>
                </div>
              </div>
            ))}
            <p className="text-slate-500 text-xs">These are payments where the Razorpay refund API failed. Process them manually in the Razorpay dashboard and click Resolved.</p>
          </div>
        )}

        {/* ── EXPORT TAB ── */}
        {activeTab === 'export' && (
          <div className="space-y-6">
            <div className="backdrop-blur-xl bg-slate-900/40 border border-cyan-400/20 rounded-xl p-6 space-y-5">
              <h3 className="text-cyan-300 font-black text-lg">📤 Export Bookings</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={LABEL_CLS}>Start Date</label>
                  <input type="date" value={exportStartDate}
                    onChange={e => setExportStartDate(e.target.value)} className={INPUT_CLS} />
                </div>
                <div>
                  <label className={LABEL_CLS}>End Date</label>
                  <input type="date" value={exportEndDate}
                    onChange={e => setExportEndDate(e.target.value)} className={INPUT_CLS} />
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button onClick={() => handleExport('csv')} disabled={exportLoading !== ''}
                  className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 disabled:opacity-50 text-white font-bold px-6 py-2.5 rounded-lg text-sm shadow-lg shadow-emerald-500/20 transition-all">
                  {exportLoading === 'csv' ? (
                    <><span className="animate-spin">⏳</span> Preparing CSV…</>
                  ) : '⬇️ Download CSV'}
                </button>
                <button onClick={() => handleExport('pdf')} disabled={exportLoading !== ''}
                  className="flex items-center gap-2 bg-gradient-to-r from-pink-500 to-violet-500 hover:from-pink-400 hover:to-violet-400 disabled:opacity-50 text-white font-bold px-6 py-2.5 rounded-lg text-sm shadow-lg shadow-pink-500/20 transition-all">
                  {exportLoading === 'pdf' ? (
                    <><span className="animate-spin">⏳</span> Preparing PDF…</>
                  ) : '⬇️ Download PDF'}
                </button>
              </div>

              {exportError && (
                <div className="p-3 bg-pink-500/15 border border-pink-400/40 rounded-lg text-pink-300 text-sm">{exportError}</div>
              )}
              {exportSuccess && (
                <div className="p-3 bg-emerald-500/15 border border-emerald-400/40 rounded-lg text-emerald-300 text-sm">✅ {exportSuccess}</div>
              )}
            </div>
          </div>
        )}

          </div>{/* /p-5 */}
        </div>{/* /main card */}
      </div>

      {/* ── OFFLINE BOOKING MODAL ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-start justify-center bg-slate-950/80 backdrop-blur-sm py-8 px-4"
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="w-full max-w-lg backdrop-blur-xl bg-slate-900/95 border border-cyan-400/30 rounded-2xl p-6 shadow-2xl shadow-cyan-400/20">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-violet-300">
                {editingBooking ? '✏️ Edit Booking' : '+ Offline Booking'}
              </h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-white text-xl leading-none">✕</button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className={LABEL_CLS}>Guest Name *</label>
                  <input type="text" placeholder="Full name" value={form.customerName}
                    onChange={e => setField('customerName', e.target.value)} className={INPUT_CLS} /></div>
                <div><label className={LABEL_CLS}>Phone *</label>
                  <input type="tel" placeholder="10-digit" value={form.customerPhone}
                    onChange={e => setField('customerPhone', e.target.value)} className={INPUT_CLS} /></div>
              </div>

              <div><label className={LABEL_CLS}>Email</label>
                <input type="email" placeholder="guest@example.com" value={form.customerEmail}
                  onChange={e => setField('customerEmail', e.target.value)} className={INPUT_CLS} /></div>

              <div className="grid grid-cols-2 gap-3">
                <div><label className={LABEL_CLS}>Date *</label>
                  <input type="date" value={form.date} onChange={e => setField('date', e.target.value)} className={INPUT_CLS} /></div>
                <div><label className={LABEL_CLS}>Start Time *</label>
                  <select value={form.startTime}
                    onChange={e => {
                      const st = Number(e.target.value);
                      const maxDur = Math.min(480, ADMIN_END - st);
                      const safeDur = Math.min(form.duration, maxDur);
                      setForm(p => ({ ...p, startTime: st, duration: safeDur }));
                    }}
                    className={INPUT_CLS}>
                    {TIME_OPTS.map(m => <option key={m} value={m}>{minutesToTime(m)}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><label className={LABEL_CLS}>Duration *</label>
                  <select value={form.duration}
                    onChange={e => {
                      const dur = Number(e.target.value);
                      setForm(p => ({ ...p, duration: dur }));
                    }}
                    className={INPUT_CLS}>
                    {DURATION_OPTS.filter(o => form.startTime + o.value <= ADMIN_END).map(o => (
                      <option key={o.value} value={o.value}>{o.label} — ₹{(Math.ceil(o.value / 60) * HOURLY_RATE).toLocaleString()}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={LABEL_CLS}>Amount Actually Received <span className="text-cyan-300/30 ml-1">(total ₹{expectedTotal})</span></label>
                  <input type="number" min={0} step={100} value={form.amountPaid}
                    onChange={e => setField('amountPaid', Number(e.target.value))} className={INPUT_CLS} />
                </div>
              </div>

              <div>
                <label className={LABEL_CLS}>Special Requests (Optional)</label>
                <textarea
                  placeholder="e.g. birthday celebration setup, water bottles, snacks, any dietary needs…"
                  value={form.specialRequests}
                  onChange={e => { if (e.target.value.length <= 500) setField('specialRequests', e.target.value); }}
                  rows={3}
                  maxLength={500}
                  className={INPUT_CLS + ' resize-none'}
                />
                <p className="text-pink-300/40 text-xs text-right mt-1">{form.specialRequests.length}/500</p>
              </div>

              {conflict && (
                <div className="p-3 bg-yellow-500/15 border border-yellow-400/40 rounded-lg text-yellow-300 text-sm">⚠️ {conflict}</div>
              )}
              {formError && (
                <div className="p-3 bg-pink-500/15 border border-pink-400/40 rounded-lg text-pink-300 text-sm">{formError}</div>
              )}

              {form.date && (
                <div className="p-3 bg-slate-800/40 rounded-lg text-xs text-cyan-300/60 space-y-1">
                  <p>📅 {form.date} · ⏱ {minutesToTime(form.startTime)} – {minutesToTime(form.startTime + form.duration)} ({fmtDuration(form.duration)})</p>
                  <p>💰 Total ₹{expectedTotal} · Paid ₹{form.amountPaid} ·
                    <span className={expectedTotal - form.amountPaid > 0 ? 'text-yellow-400 ml-1' : 'text-green-400 ml-1'}>
                      Due ₹{Math.max(0, expectedTotal - form.amountPaid)}
                    </span>
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button onClick={closeModal} className="flex-1 py-2 bg-slate-800/60 border border-slate-600 text-cyan-300 rounded-lg hover:border-slate-500 text-sm">Cancel</button>
                <button onClick={handleSubmit} disabled={formLoading || !!conflict}
                  className="flex-1 py-2 bg-gradient-to-r from-cyan-500 to-violet-500 hover:from-cyan-400 hover:to-violet-400 disabled:opacity-50 text-white font-bold rounded-lg text-sm shadow-lg shadow-cyan-500/30">
                  {formLoading ? 'Saving…' : editingBooking ? 'Save Changes' : 'Create Booking'}
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
  cyan:    { border: 'border-cyan-400/30',    text: 'from-cyan-300 to-cyan-100' },
  magenta: { border: 'border-fuchsia-400/30', text: 'from-fuchsia-300 to-pink-200' },
  yellow:  { border: 'border-yellow-400/30',  text: 'from-yellow-300 to-amber-200' },
  red:     { border: 'border-red-400/30',     text: 'from-red-300 to-rose-200' },
  orange:  { border: 'border-orange-400/30',  text: 'from-orange-300 to-amber-200' },
};

function StatCard({ label, value, color }: { label: string; value: string; color: keyof typeof COLOR_MAP }) {
  const c = COLOR_MAP[color];
  return (
    <div className={`backdrop-blur-xl bg-slate-900/40 border ${c.border} rounded-xl p-5`}>
      <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">{label}</p>
      <p className={`text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r ${c.text}`}>{value}</p>
    </div>
  );
}
