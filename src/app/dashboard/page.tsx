"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CustomerBooking } from "@/components/customer-booking";
import { logoutUser, User, getUserProfile } from "@/lib/api";
import { getEligibleUnits } from "@/lib/unit-api";

interface Booking {
  id: string;
  date: Date;
  time: string;
  customerEmail: string;
  status?: "confirmed" | "completed" | "cancelled";
}

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

export default function DashboardPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState("");
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasFetched, setHasFetched] = useState(false);
  const [eligibleUnits, setEligibleUnits] = useState<EligibleUnit[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null);

  // Load saved login state on mount
  useEffect(() => {
    // Prevent multiple fetches
    if (hasFetched) return;

    const savedToken = localStorage.getItem('authToken');
    const savedEmail = localStorage.getItem('userEmail');
    const savedIsAdmin = localStorage.getItem('isAdmin');
    
    if (!savedToken || !savedEmail) {
      setIsLoading(false);
      router.push('/login');
      return;
    }

    // If admin, redirect to admin page
    if (savedIsAdmin === 'true') {
      setIsLoading(false);
      router.push('/admin');
      return;
    }

    setAuthToken(savedToken);
    setUserEmail(savedEmail);
    
    // Fetch user profile with bookings
    const fetchUserProfile = async () => {
      try {
        const userData = await getUserProfile(savedToken);
        setCurrentUser(userData);
        
        // Fetch eligible units
        const unitsData = await getEligibleUnits(savedToken);
        const units = Array.isArray(unitsData) ? unitsData : (unitsData.data || unitsData.units || []);
        setEligibleUnits(units);
        
        // Transform bookings to match component format
        if (userData.bookings && userData.bookings.length > 0) {
          const transformedBookings = userData.bookings.map((booking: any) => ({
            id: booking.id.toString(),
            date: new Date(booking.booked_date),
            time: booking.booked_time,
            customerEmail: userData.email,
            status: booking.status || 'confirmed',
          }));
          setBookings(transformedBookings);
        }
        
        localStorage.setItem('userData', JSON.stringify(userData));
        setHasFetched(true);
      } catch (error) {
        console.error('Failed to fetch user profile:', error);
        // If token is invalid, redirect to login
        localStorage.clear();
        router.push('/login');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchUserProfile();
  }, [router, hasFetched]);

  const handleLogout = async () => {
    if (authToken) {
      try {
        await logoutUser(authToken);
      } catch (error) {
        console.error("Logout error:", error);
      }
    }
    
    localStorage.removeItem('authToken');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('isAdmin');
    localStorage.removeItem('userData');
    
    router.push('/login');
  };

  const handleCreateBooking = async (booking: { date: Date; time: string; customerEmail: string }, unitId: number) => {
    if (!authToken || !currentUser) {
      throw new Error("Authentication required");
    }

    try {
      const bookingDate = booking.date;
      const bookingTime = booking.time;

      if (!bookingDate || !bookingTime) {
        throw new Error("Date and time are required");
      }

      if (!unitId) {
        throw new Error("Unit must be selected");
      }

      // Format date if it's a Date object
      const formattedDate = bookingDate instanceof Date 
        ? bookingDate.toISOString().split('T')[0]
        : bookingDate;

      const requestBody = {
        unit_id: unitId,
        booked_date: formattedDate,
        booked_time: bookingTime,
      };

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/bookings`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create booking");
      }

      const data = await response.json();
      
      const newBooking: Booking = {
        id: data.booking.id,
        date: new Date(data.booking.booked_date),
        time: data.booking.booked_time,
        customerEmail: currentUser.email,
        status: data.booking.status || 'confirmed',
      };

      setBookings([...bookings, newBooking]);
      
      // Refresh eligible units to update booking status
      const unitsData = await getEligibleUnits(authToken);
      const units = Array.isArray(unitsData) ? unitsData : (unitsData.data || unitsData.units || []);
      setEligibleUnits(units);
      
      // Refresh user data to get updated remarks
      const userData = await getUserProfile(authToken);
      setCurrentUser(userData);
    } catch (error: any) {
      console.error("Failed to create booking:", error);
      throw error;
    }
  };

  const handleDeleteBooking = (id: string) => {
    setBookings(bookings.filter((booking) => booking.id !== id));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <CustomerBooking
      userEmail={userEmail}
      onLogout={handleLogout}
      bookings={bookings}
      onCreateBooking={handleCreateBooking}
      onDeleteBooking={handleDeleteBooking}
      currentUser={currentUser}
      authToken={authToken}
      eligibleUnits={eligibleUnits}
      selectedUnitId={selectedUnitId}
      onSelectUnit={setSelectedUnitId}
    />
  );
}
