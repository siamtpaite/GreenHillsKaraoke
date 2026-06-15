// Booking types
export interface Booking {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  date: string; // YYYY-MM-DD
  startTime: number;    // minutes from midnight (e.g., 780 = 1:00 PM)
  duration: number;     // session length in minutes (e.g., 120 = 2 hrs)
  endTime: number;      // startTime + duration (stored for query convenience)
  // Legacy fields — only present on bookings created before the timeline refactor
  startMinute?: number;
  startHour?: number;
  hours?: number;
  slotList?: string[];
  hourList?: string[];
  // Payment
  paymentType: 'full' | 'deposit';
  totalAmount: number;
  paidAmount: number;   // charged at booking time
  balanceDue: number;   // remaining at check-in (0 for full payment)
  depositPaid: number;  // alias for paidAmount — legacy compat
  amountDue: number;    // alias for balanceDue — legacy compat
  // Status
  status: 'confirmed' | 'checked_in' | 'completed' | 'no_show' | 'cancelled';
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  createdAt: Date;
  checkInTime?: Date;
  checkOutTime?: Date;
  cancelledAt?: Date;
  notes?: string;
}

// Availability response — booked time ranges for a date
export interface AvailabilityResponse {
  date: string;
  blackout?: boolean;
  bookedRanges: Array<{
    start: number;      // minutes from midnight
    end: number;        // minutes from midnight
    bookingId: string;
  }>;
}

// Booking request — sent from initiate/confirm routes and manual admin entry
export interface BookingRequest {
  date: string;
  startTime: number;    // minutes from midnight
  duration: number;     // minutes
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  paymentType: 'full' | 'deposit';
}

// Razorpay order response
export interface RazorpayOrderResponse {
  id: string;
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: string;
  attempts: number;
  notes: Record<string, any>;
  created_at: number;
}

// API Response wrapper
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}
