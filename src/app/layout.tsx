import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { PWASetup } from "@/components/PWASetup";
import { ToastProvider } from "@/components/ToastProvider";

export const metadata: Metadata = {
  title: "Oil Mart - Role Based Portal",
  description: "Premium oil mart management system",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#1e293b",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <PWASetup />
        <ThemeProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
