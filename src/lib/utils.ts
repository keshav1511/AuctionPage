import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { PlayerCategory, PlayerRole } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format currency in Indian Rupees format (e.g. ₹ 2,50,000 or ₹ 2.5 L)
 */
export function formatCurrency(amount?: number | null, compact: boolean = false): string {
  if (amount == null || isNaN(amount)) return "₹0";

  if (compact) {
    if (amount >= 10000000) {
      return `₹${(amount / 10000000).toFixed(2)} Cr`;
    }
    if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(2)} L`;
    }
    if (amount >= 1000) {
      return `₹${(amount / 1000).toFixed(0)} K`;
    }
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatRole(role?: PlayerRole | string | null): string {
  if (!role) return "—";
  switch (role) {
    case "ALL_ROUNDER":
      return "All-Rounder";
    case "BATSMAN":
      return "Batsman";
    case "BOWLER":
      return "Bowler";
    case "WICKET_KEEPER":
      return "Wicket-Keeper";
    default:
      return role;
  }
}

export function getCategoryBadgeColor(category: PlayerCategory): string {
  switch (category) {
    case "ICON":
      return "bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-amber-500/10";
    case "PLATINUM":
      return "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-cyan-500/10";
    case "GOLD":
      return "bg-yellow-500/20 text-yellow-300 border-yellow-500/40 shadow-yellow-500/10";
    case "SILVER":
      return "bg-slate-400/20 text-slate-300 border-slate-400/40 shadow-slate-400/10";
    case "EMERGING":
      return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-emerald-500/10";
    default:
      return "bg-gray-500/20 text-gray-300 border-gray-500/40";
  }
}

export function getRoleBadgeColor(role?: PlayerRole | string | null): string {
  if (!role) return "bg-slate-900 text-slate-400 border-slate-700";
  switch (role) {
    case "ALL_ROUNDER":
      return "bg-emerald-950/80 text-emerald-400 border-emerald-800";
    case "BATSMAN":
      return "bg-blue-950/80 text-blue-400 border-blue-800";
    case "BOWLER":
      return "bg-red-950/80 text-red-400 border-red-800";
    case "WICKET_KEEPER":
      return "bg-purple-950/80 text-purple-400 border-purple-800";
    default:
      return "bg-slate-900 text-slate-400 border-slate-700";
  }
}
