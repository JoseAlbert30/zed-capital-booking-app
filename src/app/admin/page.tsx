"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { AdminDashboard } from "@/components/admin-dashboard";
import { logoutUser, getAllUsers, getAllBookings, User, updatePaymentStatus, sendSOAEmail } from "@/lib/api";
import { toast } from "sonner";

interface Booking {
  id: string;
  date: Date;
  time: string;
  customerEmail: string;
  status?: "confirmed" | "completed" | "cancelled";
}

export default function AdminPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState("");
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const hasFetchedInitial = useRef(false);

  const fetchUsers = useCallback(async (token: string, filters: { search?: string; payment_status?: string; project?: string }) => {
    try {
      const usersData = await getAllUsers(token, filters);
      setUsers(usersData);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  }, []);

  const fetchBookings = useCallback(async (token: string, filters: { search?: string; status?: string; project?: string }) => {
    try {
      const bookingsData = await getAllBookings(token, filters);
      const transformedBookings = bookingsData.map((booking: any) => ({
        id: booking.id.toString(),
        date: new Date(booking.booked_date),
        time: booking.booked_time,
        customerEmail: booking.user?.email || '',
        status: 'confirmed' as const,
        user: booking.user,
        co_owners: booking.co_owners || [],
        unit_id: booking.unit_id,
        // Handover file paths
        handover_checklist: booking.handover_checklist,
        handover_declaration: booking.handover_declaration,
        handover_photo: booking.handover_photo,
        client_signature: booking.client_signature,
        // Handover file URLs
        handover_checklist_url: booking.handover_checklist_url,
        handover_declaration_url: booking.handover_declaration_url,
        handover_photo_url: booking.handover_photo_url,
        client_signature_url: booking.client_signature_url,
        // Snagging defects
        snagging_defects: booking.snagging_defects || [],
      }));
      setBookings(transformedBookings);
    } catch (error) {
      console.error('Failed to fetch bookings:', error);
    }
  }, []);

  // Load saved login state and fetch data
  useEffect(() => {
    if (hasFetchedInitial.current) return;
    
    const savedToken = localStorage.getItem('authToken');
    const savedEmail = localStorage.getItem('userEmail');
    const savedIsAdmin = localStorage.getItem('isAdmin');
    
    if (!savedToken || !savedEmail) {
      router.push('/login');
      return;
    }

    // If not admin, redirect to dashboard
    if (savedIsAdmin !== 'true') {
      router.push('/dashboard');
      return;
    }

    setAuthToken(savedToken);
    setUserEmail(savedEmail);
    
    // Initial fetch without filters
    fetchUsers(savedToken, {});
    fetchBookings(savedToken, {});
    hasFetchedInitial.current = true;
    setIsLoading(false);
  }, [router, fetchUsers, fetchBookings]);

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

  const handleDeleteBooking = (id: string) => {
    setBookings(bookings.filter((booking) => booking.id !== id));
  };

  const handleUpdateBooking = (id: string, date: Date, time: string) => {
    setBookings(bookings.map(booking => 
      booking.id === id 
        ? { ...booking, date, time }
        : booking
    ));
  };

  const handleUpdateUserPaymentStatus = async (userId: number, status: User["payment_status"], paymentDate: Date | null, receiptFile?: File) => {
    if (!authToken) return;
    
    try {
      const updatedUser = await updatePaymentStatus(userId, status, authToken, receiptFile);
      
      // Update local state with the updated user
      setUsers(users.map(user =>
        user.id === userId ? updatedUser : user
      ));
      
      toast.success('Payment status updated successfully');
    } catch (error) {
      console.error('Failed to update payment status:', error);
      toast.error('Failed to update payment status. Please try again.');
    }
  };

  const handleRegeneratePassword = (email: string) => {
    console.log('Regenerate password for:', email);
    // TODO: Implement password regeneration
  };

  const handleFilterUsers = useCallback((filters: { search?: string; payment_status?: string; project?: string }) => {
    if (authToken) {
      fetchUsers(authToken, filters);
    }
  }, [authToken, fetchUsers]);

  const handleFilterBookings = useCallback((filters: { search?: string; status?: string; project?: string }) => {
    if (authToken) {
      fetchBookings(authToken, filters);
    }
  }, [authToken, fetchBookings]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-900 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading admin data...</p>
        </div>
      </div>
    );
  }

  return (
    <AdminDashboard
      userEmail={userEmail}
      onLogout={handleLogout}
      bookings={bookings}
      onDeleteBooking={handleDeleteBooking}
      onUpdateBooking={handleUpdateBooking}
      users={users}
      onUpdateUserPaymentStatus={handleUpdateUserPaymentStatus}
      onRegeneratePassword={handleRegeneratePassword}
      onFilterUsers={handleFilterUsers}
      onFilterBookings={handleFilterBookings}
      authToken={authToken || ""}
    />
  );
}
