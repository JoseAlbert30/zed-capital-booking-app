"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: "bg-white/20 backdrop-blur-lg border-white/30",
          title: "text-white font-semibold",
          description: "text-white/90",
          actionButton: "bg-white text-black hover:bg-white/90",
          cancelButton: "bg-white/10 text-white hover:bg-white/20",
          error: "bg-red-500/20 backdrop-blur-lg border-red-500/30 text-white",
          success: "bg-green-500/20 backdrop-blur-lg border-green-500/30 text-white",
          warning: "bg-yellow-500/20 backdrop-blur-lg border-yellow-500/30 text-white",
          info: "bg-blue-500/20 backdrop-blur-lg border-blue-500/30 text-white",
        },
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
