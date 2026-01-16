# Frontend-Backend Integration Setup

## Quick Start

Your Next.js frontend is now connected to the Laravel backend! Here's how to get everything running.

## Prerequisites

### 1. Backend Running
Make sure the Laravel backend is running:

```bash
cd booking-backend
php artisan serve
```

The backend will run at: **http://localhost:8000**

### 2. Frontend Environment
The `.env.local` file is already configured in the Next.js project:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

## Starting the Frontend

```bash
# Install dependencies (if not already installed)
npm install

# Start the development server
npm run dev
```

The frontend will run at: **http://localhost:3000**

## Testing the Login Connection

### Admin Login
- **Email:** `admin@bookingsystem.com`
- **Password:** `admin123`

### Regular User Login (Paid)
- **Email:** `james.taylor@example.com`
- **Password:** `password123`

### Regular User Login (Unpaid - Will Show Error)
- **Email:** `john.smith@example.com`
- **Password:** `password123`
- **Error:** "Your payment is pending. Please complete payment to access the booking system."

## What's Connected

✅ **Login** - Uses Laravel backend authentication via Sanctum  
✅ **API Base URL** - Configured to connect to `http://localhost:8000/api`  
✅ **Auth Token** - Automatically stored after successful login  
✅ **Error Handling** - Shows user-friendly error messages  
✅ **Payment Status Check** - Validates user payment status before allowing login  

## API Configuration

### File: `/src/lib/api.ts`

This file contains all API communication functions:

- `loginUser(email, password)` - Login and get auth token
- `getCurrentUser(token)` - Get user profile
- `logoutUser(token)` - Logout
- `getAvailableSlots(date, token)` - Get booking slots
- `createBooking(bookingData, token)` - Create new booking
- `getUserBookings(token)` - Get user's bookings
- `cancelBooking(bookingId, token)` - Cancel booking
- `getAllUsers(token)` - Admin: Get all users
- `getAllBookings(token)` - Admin: Get all bookings
- `updateUserPaymentStatus(userId, status, token)` - Admin: Update payment status

## Environment Variables

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

### Backend (.env)
```
APP_URL=http://localhost:8000
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=booking_system
DB_USERNAME=root
DB_PASSWORD=
```

## Troubleshooting

### "Connection Refused" Error

**Problem:** Frontend can't reach backend
**Solution:**
1. Check backend is running: `php artisan serve`
2. Verify URL in `.env.local`: `NEXT_PUBLIC_API_URL=http://localhost:8000/api`
3. Restart frontend dev server

### "Invalid Email or Password" on Login

**Problem:** Login fails even with correct credentials
**Solution:**
1. Check user exists in database: `mysql -u root booking_system -e "SELECT email FROM users LIMIT 5;"`
2. Verify correct email format (lowercase)
3. Check user payment status for non-admin users

### "Payment Status Error" on Login

**Problem:** User sees payment error on login
**Solution:**
This is expected behavior! Regular unpaid users cannot login.

Admin can update their status:

**Via API:**
```bash
curl -X POST http://localhost:8000/api/admin/users/12/payment-status \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"payment_status": "fully_paid"}'
```

**Via MySQL:**
```bash
mysql -u root booking_system -e "UPDATE users SET payment_status = 'fully_paid' WHERE id = 12;"
```

### CORS Errors

**Problem:** Browser shows CORS error
**Solution:**
Laravel includes CORS configuration. Make sure `.env` has:
```
SANCTUM_STATEFUL_DOMAINS=localhost:3000,127.0.0.1:3000
```

## Next Steps

1. **Login Testing**
   - Test admin login
   - Test paid user login
   - Test unpaid user login (should fail)

2. **Booking Features** (to be integrated)
   - View available slots
   - Create bookings
   - Cancel bookings
   - View booking history

3. **Admin Dashboard** (to be integrated)
   - View all users
   - View all bookings
   - Update payment status
   - Manage bookings

## File Changes Made

### New Files
- `/src/lib/api.ts` - API communication service
- `/.env.local` - Environment variables for frontend

### Modified Files
- `/src/app/page.tsx` - Updated to use API for login
- `/src/components/login-page.tsx` - Added loading state and error display

## API Endpoints Available

See [INTEGRATION_GUIDE.md](../booking-backend/INTEGRATION_GUIDE.md) in the backend folder for complete API documentation.

### Quick Reference
```
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/me
GET    /api/bookings/available-slots
POST   /api/bookings
GET    /api/bookings/user
DELETE /api/bookings/{id}
GET    /api/admin/users
GET    /api/admin/bookings
POST   /api/admin/users/{id}/payment-status
```

## Support

For backend setup issues, see:
- [booking-backend/README_BACKEND.md](../booking-backend/README_BACKEND.md)
- [booking-backend/MYSQL_SETUP.md](../booking-backend/MYSQL_SETUP.md)
- [booking-backend/API_DOCUMENTATION.md](../booking-backend/API_DOCUMENTATION.md)

For test user credentials, see:
- [booking-backend/TEST_USERS.md](../booking-backend/TEST_USERS.md)

---

**All set!** Your frontend and backend are connected. Start both servers and test the login! 🚀
