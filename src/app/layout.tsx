import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { LeagueProvider } from "@/lib/context/league-context";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "NTL Auction Platform | Premier Tournament Management",
  description:
    "Official Multi-League Cricket Auction Platform. Live Bidding Stage, Dynamic Branding, Team Purses, and Player Roster Management.",
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
        <LeagueProvider>{children}</LeagueProvider>
      </body>
    </html>
  );
}
