import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { Calendar, Lock, AlertCircle } from "lucide-react";
import Image from "next/image";

interface LoginPageProps {
  onLogin: (email: string, password: string) => void;
  isLoading?: boolean;
  error?: string | null;
}

export function LoginPage({ onLogin, isLoading = false, error = null }: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(email, password);
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Black background with images */}
      <div className="hidden md:flex md:w-1/2 bg-black items-center justify-center relative">
        {/* Top logos with gradient background */}
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black via-black/80 to-transparent pt-8 pb-20 z-10">
          <div className="flex flex-col items-center justify-center gap-4">
            <Image
              src="/images/vantage.png"
              alt="Vantage"
              width={180}
              height={35}
              className="object-contain"
            />
            <Image
              src="/images/viera.png"
              alt="Viera"
              width={250}
              height={60}
              className="object-contain"
            />
          </div>
        </div>

        {/* Center hero image */}
        <div className="relative w-full h-full flex items-center justify-center">
          <Image
            src="/images/hero.jpeg"
            alt="Hero"
            fill
            className="object-cover"
          />
        </div>

        {/* Bottom powered by with gradient background */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent pb-8 pt-20 z-10">
          <div className="flex flex-col items-center justify-center gap-2 text-white">
            <span className="text-sm text-white">Powered by</span>
            <Image
              src="/images/zed.svg"
              alt="Zed"
              width={150}
              height={24}
              className="object-contain"
            />
          </div>
        </div>
      </div>

      {/* Right Side - White background with login form */}
      <div className="w-full md:w-1/2 bg-white flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-black mb-2">
              Just a few more steps
            </h1>
            <p className="text-gray-600">Sign in to manage your bookings</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-700">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="border-gray-300"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-700">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="border-gray-300"
                />
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>
            </div>
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-black hover:bg-gray-800 text-white h-12 text-base disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Signing In..." : "Sign In"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
