import { BidSlab } from "@/types";

export const DEFAULT_DYNAMIC_SLABS: BidSlab[] = [
  { min: 500, max: 5000, step: 500 },
  { min: 5000, max: 10000, step: 1000 },
  { min: 10000, max: 25000, step: 2500 },
  { min: 25000, max: 100000, step: 5000 },
  { min: 100000, max: 500000, step: 25000 },
  { min: 500000, max: 1000000, step: 50000 },
  { min: 1000000, max: 999999999, step: 100000 },
];

/**
 * Calculates unambiguous next increment from slab table
 */
export function calculateNextBid(
  currentBid: number,
  basePrice: number,
  customSlabs?: BidSlab[]
): { nextBid: number; step: number } {
  if (currentBid <= 0) {
    return { nextBid: basePrice, step: basePrice };
  }

  const slabs = customSlabs || DEFAULT_DYNAMIC_SLABS;

  for (const slab of slabs) {
    const min = slab.min ?? 0;
    if (currentBid >= min && currentBid < slab.max) {
      return { nextBid: currentBid + slab.step, step: slab.step };
    }
  }

  return { nextBid: currentBid + 100000, step: 100000 };
}
