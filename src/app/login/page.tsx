"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoginPage } from "@/components/login-page";
import { loginUser } from "@/lib/api";

export default function Login() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Check if already logged in
  useEffect(() => {
    const savedToken = localStorage.getItem('authToken');
    if (savedToken) {
      // Already logged in, redirect to home
      router.push('/');
    }
  }, [router]);

  const handleLogin = async (email: string, password: string) => {
    setIsLoading(true);
    setLoginError(null);
    
    try {
      console.log('Starting login...');
      const response = await loginUser(email, password);
      console.log('Login response:', response);
      
      // Check if user has paid status (admin can have any status)
      if (response.user.payment_status !== "fully_paid" && email !== "admin@bookingsystem.com") {
        console.log('Payment not complete');
        setLoginError("Your payment is pending. Please complete payment to access the booking system.");
        setIsLoading(false);
        return;
      }

      // Store auth data
      const adminStatus = response.user.email === "admin@bookingsystem.com";
      localStorage.setItem('authToken', response.token);
      localStorage.setItem('userEmail', response.user.email);
      localStorage.setItem('isAdmin', adminStatus.toString());
      localStorage.setItem('userData', JSON.stringify(response.user));
      
      console.log('Login successful, redirecting...');
      
      // Redirect based on role
      if (adminStatus) {
        router.push('/admin');
      } else {
        router.push('/dashboard');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      setLoginError(error.message || "Invalid email or password");
    } finally {
      setIsLoading(false);
    }
  };

  return <LoginPage onLogin={handleLogin} isLoading={isLoading} error={loginError} />;
}
