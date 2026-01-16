"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Check authentication and redirect accordingly
    const savedToken = localStorage.getItem('authToken');
    const savedIsAdmin = localStorage.getItem('isAdmin');
    
    if (!savedToken) {
      // Not logged in, redirect to login
      router.push('/login');
    } else if (savedIsAdmin === 'true') {
      // Admin user, redirect to admin page
      router.push('/admin');
    } else {
      // Regular user, redirect to dashboard
      router.push('/dashboard');
    }
  }, [router]);

  // Show loading while redirecting
  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="text-white text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
        <p>Loading...</p>
      </div>
    </div>
  );
}
