// app/layout.tsx

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/context/auth-context";
import PresencePinger from "@/components/presence/PresencePinger";
import RealtimeBridge from "@/components/realtime/RealtimeBridge";
import SWRProvider from "@/components/providers/SWRProvider";
import SessionProviderClient from "@/components/providers/SessionProviderClient";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Task Management Birds of Eden",
  description: "Task Management Birds of Eden",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SessionProviderClient>
          <SWRProvider>
            <AuthProvider>
              <PresencePinger />
              <RealtimeBridge />
              {children}
              <Toaster position="bottom-right" richColors />
            </AuthProvider>
          </SWRProvider>
        </SessionProviderClient>
      </body>
    </html>
  );
}
