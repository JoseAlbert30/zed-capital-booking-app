import type { Metadata } from "next";
import "@/styles/index.css";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "Modern Booking System",
  description: "Property booking management system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning={true}>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
