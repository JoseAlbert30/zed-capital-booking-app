"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CustomerBooking } from "@/components/customer-booking";
import { Booking, User } from "@/lib/api";
import { getEligibleUnits } from "@/lib/unit-api";

type EligibleUnit = {
  id: number;
  unit: string;
  property: {
    id: number;
    project_name: string;
    location: string;
  };
  has_booking: boolean;
  booking?: {
    id: number;
    booked_date: string;
    booked_time: string;
  };
};

function BookingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eligibleUnits, setEligibleUnits] = useState<EligibleUnit[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null);

  useEffect(() => {
    const validateMagicLink = async () => {
      const token = searchParams.get('token');
      const unitIdParam = searchParams.get('unit_id');
      
      if (!token) {
        setError("Invalid booking link. Please contact support.");
        setIsLoading(false);
        return;
      }

      try {
        // Validate magic link with backend
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/magic-link`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ token }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || "Invalid or expired booking link");
        }

        const data = await response.json();
        
        // Transform bookings to match component format
        const transformedBookings = (data.user.bookings || []).map((booking: any) => ({
          id: booking.id,
          date: new Date(booking.booked_date),
          time: booking.booked_time,
          customerEmail: data.user.email,
          status: booking.status || 'confirmed',
          user_id: booking.user_id,
          booked_date: booking.booked_date,
          booked_time: booking.booked_time,
          created_at: booking.created_at,
          updated_at: booking.updated_at,
        }));
        
        // Store authentication
        setAuthToken(data.token);
        setUser(data.user);
        setBookings(transformedBookings);
        
        // Fetch eligible units
        const unitsData = await getEligibleUnits(data.token);
        console.log('Eligible units response:', unitsData);
        
        // Handle both array and object with data property
        const units = Array.isArray(unitsData) ? unitsData : (unitsData.data || unitsData.units || []);
        setEligibleUnits(units);
        
        // Auto-select unit if unit_id in URL
        if (unitIdParam) {
          const unitId = parseInt(unitIdParam);
          const unit = units.find((u: EligibleUnit) => u.id === unitId);
          if (unit) {
            setSelectedUnitId(unitId);
          }
        }
        
        // Store in localStorage for session persistence
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('userEmail', data.user.email);
        localStorage.setItem('isAdmin', 'false');
        
        // Redirect to dashboard with unit_id parameter if specified
        if (unitIdParam) {
          router.push(`/dashboard?unit_id=${unitIdParam}`);
        } else {
          router.push('/');
        }
        
      } catch (err: any) {
        console.error("Magic link validation error:", err);
        setError(err.message || "Failed to validate booking link. The link may have expired or already been used.");
        setIsLoading(false);
      }
    };

    validateMagicLink();
  }, [searchParams]);

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('isAdmin');
    router.push('/login');
  };

  const handleCreateBooking = async (booking: { 
    date: Date; 
    time: string; 
    customerEmail: string;
    isOwnerAttending?: boolean;
    poaDocument?: File;
    attorneyIdDocument?: File;
  }, unitId: number) => {
    if (!authToken || !user) return;

    console.log('=== handleCreateBooking called ===');
    console.log('Booking data received:', booking);
    console.log('Unit ID:', unitId);
    console.log('Auth token:', authToken ? 'Present' : 'Missing');
    console.log('User:', user);

    try {
      const bookingDate = booking.date;
      const bookingTime = booking.time;

      console.log('Extracted bookingDate:', bookingDate);
      console.log('Extracted bookingTime:', bookingTime);

      if (!bookingDate || !bookingTime) {
        throw new Error("Date and time are required");
      }

      if (!unitId) {
        throw new Error("Unit must be selected");
      }

      // Format date for Dubai timezone - always use the displayed date values
      // Create date string from components to avoid timezone conversion
      let formattedDate: string;
      if (bookingDate instanceof Date) {
        const year = bookingDate.getFullYear();
        const month = String(bookingDate.getMonth() + 1).padStart(2, '0');
        const day = String(bookingDate.getDate()).padStart(2, '0');
        formattedDate = `${year}-${month}-${day}`;
        console.log('Date components - year:', year, 'month:', month, 'day:', day);
      } else {
        formattedDate = bookingDate;
      }

      console.log('Formatted date (Dubai time):', formattedDate);
      console.log('API URL:', process.env.NEXT_PUBLIC_API_URL);

      const requestBody = {
        unit_id: unitId,
        booked_date: formattedDate,
        booked_time: bookingTime,
        is_owner_attending: booking.isOwnerAttending ?? true,
      };

      console.log('Request body:', requestBody);

      // Use FormData if POA documents are provided
      let body: any;
      let headers: any = {
        Authorization: `Bearer ${authToken}`,
      };

      if (booking.poaDocument || booking.attorneyIdDocument) {
        console.log('Using FormData - isOwnerAttending:', booking.isOwnerAttending);
        const formData = new FormData();
        formData.append('unit_id', unitId.toString());
        formData.append('booked_date', formattedDate);
        formData.append('booked_time', bookingTime);
        
        // Explicitly set is_owner_attending
        const ownerAttendingValue = booking.isOwnerAttending === true ? '1' : '0';
        console.log('Setting is_owner_attending to:', ownerAttendingValue);
        formData.append('is_owner_attending', ownerAttendingValue);
        
        if (booking.poaDocument) {
          console.log('Appending POA document:', booking.poaDocument.name);
          formData.append('poa_document', booking.poaDocument);
        }
        if (booking.attorneyIdDocument) {
          console.log('Appending Attorney ID document:', booking.attorneyIdDocument.name);
          formData.append('attorney_id_document', booking.attorneyIdDocument);
        }
        
        // Log FormData contents
        console.log('FormData entries:');
        for (let pair of formData.entries()) {
          console.log(pair[0] + ':', pair[1]);
        }
        
        body = formData;
        // Don't set Content-Type header for FormData, let browser set it with boundary
      } else {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(requestBody);
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/bookings`, {
        method: "POST",
        headers: headers,
        body: body,
      });

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);

      if (!response.ok) {
        const error = await response.json();
        console.error('Error response:', error);
        throw new Error(error.message || "Failed to create booking");
      }

      const data = await response.json();
      console.log('Success response:', data);
      
      const newBooking: Booking = {
        id: data.booking.id,
        user_id: data.booking.user_id,
        booked_date: data.booking.booked_date,
        booked_time: data.booking.booked_time,
        status: data.booking.status || 'confirmed',
        created_at: data.booking.created_at,
        updated_at: data.booking.updated_at,
      };

      setBookings([...bookings, newBooking]);
      console.log('Booking added to state');
      
      // Refresh eligible units to update booking status
      const unitsData = await getEligibleUnits(authToken);
      const units = Array.isArray(unitsData) ? unitsData : (unitsData.data || unitsData.units || []);
      setEligibleUnits(units);
      
      // Refresh user data to get updated remarks
      const userResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/me`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      
      if (userResponse.ok) {
        const updatedUser = await userResponse.json();
        setUser(updatedUser);
        console.log('User data refreshed');
      }
    } catch (error: any) {
      console.error("Failed to create booking:", error);
      throw error;
    }
  };

  const handleDeleteBooking = async (id: string | number) => {
    if (!authToken) return;

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/bookings/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to delete booking");
      }

      setBookings(bookings.filter((booking) => booking.id.toString() !== id.toString()));
    } catch (error) {
      console.error("Failed to delete booking:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Validating your booking link...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-white text-center max-w-md mx-auto p-6">
          <div className="mb-6">
            <svg
              className="w-16 h-16 mx-auto text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold mb-4">Booking Link Error</h1>
          <p className="text-gray-300 mb-6">{error}</p>
          <p className="text-sm text-gray-400">
            If you continue to experience issues, please contact support at{" "}
            <a href="mailto:vantage@zedcapital.ae" className="text-blue-400 hover:underline">
              vantage@zedcapital.ae
            </a>
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-white text-center">
          <p>User not found</p>
        </div>
      </div>
    );
  }

  return (
    <CustomerBooking
      userEmail={user.email}
      onLogout={handleLogout}
      bookings={bookings}
      onCreateBooking={handleCreateBooking}
      onDeleteBooking={(id) => handleDeleteBooking(id)}
      currentUser={user}
      authToken={authToken}
      eligibleUnits={eligibleUnits}
      selectedUnitId={selectedUnitId}
      onSelectUnit={(unitId) => {
        console.log('onSelectUnit called with:', unitId);
        setSelectedUnitId(unitId);
      }}
    />
  );
}

export default function BookingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    }>
      <BookingPageContent />
    </Suspense>
  );
}
