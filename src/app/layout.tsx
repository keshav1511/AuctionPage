import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "NTL Auction Platform | Nalanda Turf League Season 1",
  description:
    "Official Auction Management Platform for Nalanda Turf League (NTL) Season 1. Live Bidding Stage, Team Purses, and Player Roster Management.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased bg-[#090D10] text-slate-100 min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
