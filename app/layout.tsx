import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import Providers from "@/components/providers/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "ShiftSync", template: "%s | ShiftSync" },
  description: "Shift management system for multi-location teams",
  themeColor: "#ffffff",
  appleWebApp: {
    capable: true,
    title: "ShiftSync",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    title: "ShiftSync",
    description: "Shift management system for multi-location teams",
    url: "https://shiftsync.vercel.app",
    siteName: "ShiftSync",
    images: [{ url: "/assets/logo.png", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ShiftSync",
    description: "Shift management system for multi-location teams",
    images: [{ url: "/assets/logo.png", width: 1200, height: 630 }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
