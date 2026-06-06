# Green Hills Karaoke Booking System

A real-time online booking system for the Green Hills Karaoke lounge in Lamka, Manipur. Built with Next.js, Firebase Firestore, and Razorpay payments.

## Architecture Overview

### Tech Stack
- **Frontend**: Next.js 15 (App Router) + TypeScript + Tailwind CSS
- **Backend**: Next.js API Routes (serverless)
- **Database**: Firebase Firestore (real-time, transactions)
- **Payments**: Razorpay (₹500 deposit collection)
- **Hosting**: Vercel

### Database Schema
```
/availability/{YYYY-MM-DD}/slots/{hour}
  ├─ status: "available" | "booked" | "blackout"
  ├─ bookingId: string
  └─ bookedAt: timestamp

/bookings/{bookingId}
  ├─ customerName: string
  ├─ customerEmail: string
  ├─ customerPhone: string
  ├─ date: string
  ├─ hours: number
  ├─ hourList: string[]
  ├─ depositPaid: number
  ├─ totalAmount: number
  ├─ amountDue: number
  ├─ status: "pending_payment" | "pending_full_payment" | "confirmed" | "completed" | "no_show" | "cancelled"
  ├─ razorpayOrderId: string
  ├─ razorpayPaymentId: string
  ├─ createdAt: timestamp
  └─ checkInTime: timestamp (optional)

/operatingHours/{dayOfWeek}
  ├─ open: number (12)
  ├─ close: number (22)
  └─ isOpen: boolean

/blackoutDates/{YYYY-MM-DD}
  ├─ reason: string
  └─ createdBy: string
```

## Folder Structure

```
greenhills-karaoke/
├── app/
│   ├── api/
│   │   ├── availability/
│   │   │   └── route.ts              # GET availability for a date
│   │   ├── bookings/
│   │   │   ├── initiate/route.ts     # POST create booking + Razorpay order
│   │   │   └── [bookingId]/
│   │   │       └── cancel/route.ts   # POST cancel booking
│   │   └── webhooks/
│   │       └── razorpay/route.ts     # Razorpay payment confirmation
│   ├── (pages)/
│   │   ├── page.tsx                  # Home (to be built)
│   │   ├── booking/
│   │   │   └── page.tsx              # Booking flow (to be built)
│   │   └── admin/
│   │       └── page.tsx              # Admin dashboard (to be built)
│   └── layout.tsx
│
├── lib/
│   ├── firebase/
│   │   ├── config.ts                 # Client Firebase config
│   │   └── admin.ts                  # Admin SDK
│   ├── booking/
│   │   └── service.ts                # Booking logic with transactions
│   ├── payment/
│   │   └── razorpay.ts               # Razorpay integration
│   ├── admin/
│   │   └── service.ts                # Admin utilities
│   ├── utils/
│   │   └── availability.ts           # Availability management
│   └── types.ts                      # TypeScript interfaces
│
├── public/                           # Static assets
├── .env.local.example               # Environment template
├── next.config.ts
├── tsconfig.json
└── package.json
```

## Setup Instructions

### 1. Clone & Install Dependencies
```bash
npm install
# or
yarn install
```

### 2. Set Up Environment Variables

Copy `.env.local.example` to `.env.local`:
```bash
cp .env.local.example .env.local
```

Fill in the values:
```
# Firebase credentials (get from Firebase Console)
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

# Firebase Admin SDK (get from Service Account key)
FIREBASE_PROJECT_ID=...
FIREBASE_DATABASE_URL=...
FIREBASE_ADMIN_SDK_JSON=... # base64 encoded

# Razorpay
NEXT_PUBLIC_RAZORPAY_KEY_ID=... (from Elvis's account)
RAZORPAY_KEY_SECRET=...

# Admin
ADMIN_EMAIL=greenhillskaraoke@gmail.com
```

### 3. Set Up Firestore Database

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create Firestore database (India region)
3. Initialize operating hours:

```javascript
// Initialize via Firebase Console or script
db.collection('operatingHours').doc('monday').set({ open: 12, close: 22, isOpen: true });
db.collection('operatingHours').doc('tuesday').set({ open: 12, close: 22, isOpen: true });
// ... repeat for all days
```

### 4. Configure Razorpay Webhook

In your Razorpay account dashboard:
1. Go to Settings → Webhooks
2. Add webhook URL: `https://your-domain.com/api/webhooks/razorpay`
3. Select events: `payment.authorized`, `payment.captured`
4. Get the webhook secret (use this for signature verification if needed)

### 5. Deploy to Vercel

```bash
git push origin main
```

Vercel will automatically deploy. Set environment variables in Vercel dashboard.

## API Endpoints

### GET `/api/availability?date=2026-06-15`
Get all slots for a date.

**Response:**
```json
{
  "success": true,
  "data": {
    "date": "2026-06-15",
    "slots": [
      { "hour": 12, "status": "available", "timeSlot": "12:00 PM - 1:00 PM" },
      { "hour": 13, "status": "booked", "timeSlot": "1:00 PM - 2:00 PM" }
    ]
  }
}
```

### POST `/api/bookings/initiate`
Create a booking and get Razorpay order details.

**Request:**
```json
{
  "date": "2026-06-15",
  "startHour": 14,
  "hours": 2,
  "customerName": "John Doe",
  "customerEmail": "john@example.com",
  "customerPhone": "9876543210"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "bookingId": "KAR123456",
    "razorpayOrder": {
      "id": "order_ABC123",
      "amount": 50000,
      "currency": "INR"
    }
  }
}
```

### POST `/api/webhooks/razorpay`
Razorpay calls this after payment success. Locks booking and releases.

### POST `/api/bookings/[bookingId]/cancel`
Cancel a booking and release slots.

## Key Features Implemented

✅ **Overbooking Prevention**: Firestore transactions ensure atomicity
✅ **Real-time Availability**: Slots update instantly across all clients
✅ **Payment Integration**: Razorpay ₹500 deposit collection
✅ **Non-refundable Deposits**: ₹500 locked after booking, released only on cancellation
✅ **Slot Release**: Cancelled bookings automatically release slots
✅ **Admin Utilities**: Blackout dates, manual slot release, operating hours

## What's Missing (To Be Built)

### Frontend Pages
- ❌ Home page with calendar picker
- ❌ Booking flow (date → hours → payment)
- ❌ Confirmation & receipt page
- ❌ Admin dashboard (login, view bookings, manage dates)
- ❌ Customer cancellation interface

### Email/Notifications
- ❌ Booking confirmation email
- ❌ Payment receipt
- ❌ Cancellation notice

### Additional Admin Features
- ❌ Check-in/check-out tracking
- ❌ Revenue reports
- ❌ Booking history & analytics
- ❌ Manual payment recording (if customer pays on arrival)

## Payment Flow

```
Customer books → Initiate API call → Razorpay order created → Payment modal opens
    ↓
Customer pays ₹500 → Razorpay processes → Webhook fires → Booking confirmed
    ↓
Slots locked → Email sent → Customer can cancel (loses ₹500) → Arrives & pays balance
```

## Development Notes

- All API routes use TypeScript for type safety
- Firebase transactions prevent race conditions
- Razorpay webhook is the source of truth for payment confirmation
- Never trust client-side payment confirmations
- Blackout dates override operating hours
- No customer authentication required (guest checkout only)

## Testing the System

```bash
# Start dev server
npm run dev

# Test availability
curl http://localhost:3000/api/availability?date=2026-06-20

# Test booking
curl -X POST http://localhost:3000/api/bookings/initiate \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2026-06-20",
    "startHour": 14,
    "hours": 2,
    "customerName": "Test User",
    "customerEmail": "test@example.com",
    "customerPhone": "9876543210"
  }'
```

## Security Considerations

- Validate all input (dates, hours, emails, phones)
- Verify Razorpay signatures on webhooks
- Use environment variables for secrets (never commit .env.local)
- Enable Firebase security rules
- Admin operations require email verification (to be added)
- Rate limiting recommended for booking endpoint

## Next Steps

1. **Build Home Page**: Calendar picker + availability display
2. **Build Booking Flow**: Customer details form + Razorpay checkout
3. **Build Admin Dashboard**: Login, booking management, reporting
4. **Add Email Notifications**: Confirmation, receipt, cancellation
5. **Deploy to Vercel**: Point custom domain, test in production
6. **Monitor Webhooks**: Check Razorpay dashboard for payment status

---

**Built by Siam T. Paite for Green Hills Karaoke**
