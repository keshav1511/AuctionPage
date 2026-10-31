import { BrandingPalette } from "@/types";

/**
 * Converts Hex to RGB
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let cleanHex = hex.replace("#", "").trim();
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split("").map((c) => c + c).join("");
  }
  const num = parseInt(cleanHex, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

/**
 * Converts RGB to HSL
 */
export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/**
 * Converts HSL back to Hex
 */
export function hslToHex(h: number, s: number, l: number): string {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

/**
 * Generates an authoritative sports tournament palette from a primary brand color.
 * Designed specifically for sports broadcast clarity, avoiding artificial neon and over-saturation.
 */
export function generateSportsBrandingPalette(primaryHex: string): BrandingPalette {
  try {
    const { r, g, b } = hexToRgb(primaryHex);
    const { h, s, l } = rgbToHsl(r, g, b);

    // Warm metallic trophy gold for bids and leaderboards
    const secondaryHex = "#F59E0B";

    // High-visibility accent color (elevated lightness of primary, constrained saturation)
    const accentHex = hslToHex(h, Math.min(s, 75), Math.min(Math.max(l, 45), 65));

    // Refined, natural dark stadium canvas with very subtle hue tinting
    const backgroundHex = hslToHex(h, Math.min(s, 20), 4);
    const cardHex = hslToHex(h, Math.min(s, 18), 8);
    const borderHex = hslToHex(h, Math.min(s, 15), 16);

    // High-contrast clean typography
    const textHex = "#F8FAFC";

    return {
      primary: primaryHex,
      secondary: secondaryHex,
      accent: accentHex,
      background: backgroundHex,
      card: cardHex,
      border: borderHex,
      text: textHex,
    };
  } catch {
    // Standard NTL Turf Default
    return {
      primary: "#059669",
      secondary: "#F59E0B",
      accent: "#10B981",
      background: "#090D10",
      card: "#11161B",
      border: "#1E293B",
      text: "#F8FAFC",
    };
  }
}

/**
 * Builds CSS variables mapping string for application styling
 */
export function getLeagueCssVariables(palette?: BrandingPalette): Record<string, string> {
  const p = palette || {
    primary: "#059669",
    secondary: "#F59E0B",
    accent: "#10B981",
    background: "#090D10",
    card: "#11161B",
    border: "#1E293B",
    text: "#F8FAFC",
  };

  return {
    "--league-primary": p.primary,
    "--league-secondary": p.secondary,
    "--league-accent": p.accent,
    "--league-bg": p.background,
    "--league-card": p.card,
    "--league-border": p.border,
    "--league-text": p.text,
  };
}
