// Booking types
export interface Booking {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  date: string; // YYYY-MM-DD
  hours: number;
  hourList: string[]; // ["14", "15"]
  depositPaid: number;
  totalAmount: number;
  amountDue: number;
  status: 'pending_full_payment' | 'confirmed' | 'completed' | 'no_show' | 'cancelled';
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  createdAt: Date;
  checkInTime?: Date;
  checkOutTime?: Date;
  cancelledAt?: Date;
}

// Slot types
export interface Slot {
  hour: number;
  status: 'available' | 'booked' | 'blackout';
  customerId?: string;
  bookingId?: string;
  bookedAt?: Date;
}

// Availability response
export interface AvailabilityResponse {
  date: string;
  blackout?: boolean;
  slots: Array<{
    hour: number;
    status: 'available' | 'booked' | 'blackout';
    timeSlot: string; // "12:00 PM - 1:00 PM"
  }>;
}

// Booking request
export interface BookingRequest {
  date: string;
  hours: number;
  startHour: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
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
