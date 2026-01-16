# Zed Capital Booking App

Next.js frontend application for Viera Residences handover booking and management system.

## 🚀 Features

- **Admin Dashboard**: Comprehensive booking management with filters and search
- **Unit Management**: View and manage properties, units, and owners
- **Booking Calendar**: Interactive calendar for scheduling handover appointments
- **Handover Workflow**: 
  - Download and upload handover checklist and declaration PDFs
  - Capture handover photos
  - Digital signature collection
  - Complete handover with email confirmations
- **Client Portal**: Magic link authentication for passwordless client access
- **Timeline Tracking**: View complete audit trail of all activities
- **Responsive Design**: Mobile-friendly interface with Tailwind CSS

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** >= 18.x
- **npm** >= 9.x or **yarn** >= 1.22.x
- **Git**

## 🛠️ Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/JoseAlbert30/zed-capital-booking-app.git
cd zed-capital-booking-app
```

### 2. Install Dependencies

Using npm:
```bash
npm install
```

Or using yarn:
```bash
yarn install
```

### 3. Environment Configuration

Create a `.env.local` file in the root directory:

```env
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:8000/api

# Application URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional: Enable debug mode
NEXT_PUBLIC_DEBUG=true
```

**Important Notes:**
- `NEXT_PUBLIC_API_URL` must point to your Laravel backend API
- Ensure the backend is running before starting the frontend
- The `NEXT_PUBLIC_` prefix makes variables accessible in the browser

### 4. Verify Backend Connection

Ensure your Laravel backend is running at the URL specified in `NEXT_PUBLIC_API_URL`:

```bash
# Test backend connection
curl http://localhost:8000/api/properties
```

## 🚀 Running the Application

### Development Mode

Start the development server:

```bash
npm run dev
```

Or with yarn:
```bash
yarn dev
```

The application will be available at: **http://localhost:3000**

### Production Build

Build the application for production:

```bash
npm run build
npm run start
```

Or with yarn:
```bash
yarn build
yarn start
```

## 🔐 Default Login Credentials

**Admin Account:**
- Email: `admin@zedcapital.ae`
- Password: `password`

**Test Client (Magic Link):**
- Email: `john.doe@example.com`
- Access via magic link sent to email

## 📱 Application Routes

### Public Routes
- `/` - Home page with login
- `/login` - Admin login page
- `/booking` - Client booking page (magic link access)

### Protected Admin Routes
- `/admin` - Main admin dashboard
- `/admin/units/[id]` - Unit details and management
- `/admin/users/[id]` - User/owner details

### Client Routes
- `/dashboard` - Client dashboard (after magic link login)

## 🎨 Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **State Management**: React Hooks
- **HTTP Client**: Fetch API
- **Forms**: React Hook Form
- **Date Picker**: React Day Picker
- **Icons**: Lucide React
- **Toast Notifications**: Sonner

## 📂 Project Structure

```
src/
├── app/                        # Next.js App Router pages
│   ├── admin/                  # Admin dashboard pages
│   │   ├── page.tsx           # Main dashboard
│   │   ├── units/[id]/        # Unit management
│   │   └── users/[id]/        # User management
│   ├── booking/               # Client booking page
│   ├── dashboard/             # Client dashboard
│   ├── login/                 # Login page
│   └── page.tsx               # Home page
├── components/                 # React components
│   ├── ui/                    # shadcn/ui components
│   ├── admin-dashboard.tsx    # Main admin component
│   ├── customer-booking.tsx   # Client booking component
│   └── login-page.tsx         # Login component
├── lib/                       # Utility functions
│   ├── api.ts                 # API client functions
│   └── unit-api.ts            # Unit-specific API calls
└── styles/                    # Global styles
    ├── index.css
    └── tailwind.css
```

## 🔌 API Integration

The app communicates with the Laravel backend via REST API. Key API functions are in:

- `src/lib/api.ts` - General API calls (auth, bookings, users)
- `src/lib/unit-api.ts` - Unit-specific API calls

### Example API Call

```typescript
import { loginAdmin } from '@/lib/api';

const response = await loginAdmin({
  email: 'admin@zedcapital.ae',
  password: 'password'
});

if (response.success) {
  localStorage.setItem('authToken', response.token);
}
```

## 🎨 Customization

### Changing Colors

Edit `tailwind.config.ts`:

```typescript
theme: {
  extend: {
    colors: {
      primary: '#your-color',
      secondary: '#your-color',
    }
  }
}
```

### Adding New Components

Use shadcn/ui CLI:

```bash
npx shadcn-ui@latest add button
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add table
```

## 📧 Email Templates

Email templates are managed in the backend. The frontend triggers email sending through API calls:

- Booking confirmation
- Handover notice
- Booking cancellation/rescheduling
- Handover completion congratulations

## 📱 Mobile Responsiveness

The application is fully responsive and works on:
- Desktop (1920px+)
- Laptop (1024px - 1919px)
- Tablet (768px - 1023px)
- Mobile (320px - 767px)

## 🔧 Troubleshooting

### API Connection Issues

**Error**: "Failed to fetch" or CORS errors

**Solution**:
1. Verify backend is running: `curl http://localhost:8000/api/properties`
2. Check `.env.local` has correct `NEXT_PUBLIC_API_URL`
3. Ensure Laravel backend has CORS configured in `config/cors.php`:

```php
'paths' => ['api/*'],
'allowed_origins' => ['http://localhost:3000'],
```

### Login Not Working

**Error**: "Invalid credentials"

**Solution**:
1. Verify admin user exists in backend database
2. Check network tab in browser dev tools for API response
3. Ensure backend is seeded: `php artisan db:seed`

### Images Not Loading

**Error**: Images from backend not displaying

**Solution**:
1. Verify storage link exists: `php artisan storage:link`
2. Check file permissions on backend storage folder
3. Verify image URLs in browser network tab

### Build Errors

**Error**: TypeScript errors during build

**Solution**:
```bash
rm -rf .next
rm -rf node_modules
npm install
npm run build
```

### Port Already in Use

**Error**: Port 3000 already in use

**Solution**:
```bash
# Use different port
PORT=3001 npm run dev

# Or kill process using port 3000
lsof -ti:3000 | xargs kill -9
```

## 🚀 Production Deployment

### Using Vercel (Recommended)

1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables:
   ```
   NEXT_PUBLIC_API_URL=https://your-api-domain.com/api
   NEXT_PUBLIC_APP_URL=https://your-app-domain.com
   ```
4. Deploy

### Using Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

Build and run:
```bash
docker build -t zed-booking-app .
docker run -p 3000:3000 zed-booking-app
```

### Manual Deployment

```bash
npm run build
npm run start
```

Or use PM2:
```bash
npm install -g pm2
pm2 start npm --name "zed-booking-app" -- start
pm2 save
pm2 startup
```

## 🧪 Testing

Run development server and test manually:

```bash
npm run dev
```

Open http://localhost:3000 and:
1. Login as admin
2. Create a booking
3. Test handover workflow
4. Verify email notifications (check backend Mailtrap)

## 📚 Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [shadcn/ui](https://ui.shadcn.com)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)

## 🔗 Related Repositories

- **Backend API**: https://github.com/JoseAlbert30/zed-capital-booking-api

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is proprietary software developed for Zed Capital Real Estate.

## 📧 Support

For support, email: vantage@zedcapital.ae

---

**Built with Next.js 14** | **Powered by Zed Capital**