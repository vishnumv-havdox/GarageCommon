/**
 * Theme & UI Colors Manager for Drive Flow
 * 
 * Provides live theme switching, custom hex color palettes, contrast computation,
 * local persistence, and database synchronization via company_profiles.
 */

export interface ThemeConfig {
  id: string;
  name: string;
  primaryHex: string;
  primaryForegroundHex?: string;
  accentHex?: string;
  ringHex?: string;
  description: string;
  badge?: string;
}

export const THEME_PRESETS: ThemeConfig[] = [
  {
    id: "havdox-onyx",
    name: "HavDox Signature Onyx",
    primaryHex: "#000000",
    primaryForegroundHex: "#ffffff",
    ringHex: "#4d8dff",
    accentHex: "#6366f1",
    description: "Official HavDox high-contrast obsidian with cyan/indigo precision focus.",
    badge: "Official Brand",
  },
  {
    id: "driveflow-amber",
    name: "DriveFlow Amber Gold",
    primaryHex: "#f59e0b",
    primaryForegroundHex: "#000000",
    ringHex: "#f59e0b",
    accentHex: "#fef3c7",
    description: "Dynamic automotive warmth, workshop energy, and high visual clarity.",
    badge: "Workshop Classic",
  },
  {
    id: "apex-cobalt",
    name: "Apex Cobalt Blue",
    primaryHex: "#2563eb",
    primaryForegroundHex: "#ffffff",
    ringHex: "#3b82f6",
    accentHex: "#dbeafe",
    description: "Precision German engineering blue, modern fleet & diagnostic aesthetic.",
    badge: "Performance",
  },
  {
    id: "velocity-emerald",
    name: "Velocity Emerald",
    primaryHex: "#059669",
    primaryForegroundHex: "#ffffff",
    ringHex: "#10b981",
    accentHex: "#d1fae5",
    description: "Eco performance, fresh vitality, and trustworthy service operations.",
    badge: "Eco Vitality",
  },
  {
    id: "crimson-turbo",
    name: "Crimson Motorsport",
    primaryHex: "#dc2626",
    primaryForegroundHex: "#ffffff",
    ringHex: "#ef4444",
    accentHex: "#fee2e2",
    description: "Aggressive racing red, high-octane performance and bold highlights.",
    badge: "Motorsport",
  },
  {
    id: "royal-violet",
    name: "Royal Violet Luxury",
    primaryHex: "#7c3aed",
    primaryForegroundHex: "#ffffff",
    ringHex: "#8b5cf6",
    accentHex: "#ede9fe",
    description: "Prestige luxury detailing, executive styling, and refined finish.",
    badge: "Executive",
  },
  {
    id: "hyperdrive-cyan",
    name: "Cyan Hyperdrive",
    primaryHex: "#0891b2",
    primaryForegroundHex: "#ffffff",
    ringHex: "#06b6d4",
    accentHex: "#cffafe",
    description: "Futuristic EV technology, digital diagnostics, and electric styling.",
    badge: "Electric",
  },
  {
    id: "sunset-orange",
    name: "Sunset Supercharge",
    primaryHex: "#ea580c",
    primaryForegroundHex: "#ffffff",
    ringHex: "#f97316",
    accentHex: "#ffedd5",
    description: "Bold mechanics orange, maximum contrast and vibrant service alerts.",
    badge: "Vibrant",
  },
  {
    id: "stealth-slate",
    name: "Stealth Titanium",
    primaryHex: "#334155",
    primaryForegroundHex: "#ffffff",
    ringHex: "#64748b",
    accentHex: "#f1f5f9",
    description: "Minimalist industrial slate, subdued elegance and distraction-free UI.",
    badge: "Minimalist",
  },
];

export const STORAGE_KEY = "driveflow_ui_theme";

/**
 * Converts Hex string (#RRGGBB or #RGB) to HSL components
 */
export function hexToHsl(hex: string): { h: number; s: number; l: number; hslStr: string } {
  let clean = hex.replace("#", "").trim();
  if (clean.length === 3) {
    clean = clean.split("").map((c) => c + c).join("");
  }
  if (clean.length !== 6) {
    return { h: 0, s: 0, l: 0, hslStr: "0 0% 0%" };
  }

  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;

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
    h = h / 6;
  }

  const hDeg = Math.round(h * 360);
  const sPct = Math.round(s * 100);
  const lPct = Math.round(l * 100);

  return {
    h: hDeg,
    s: sPct,
    l: lPct,
    hslStr: `${hDeg} ${sPct}% ${lPct}%`,
  };
}

/**
 * Computes optimal high-contrast foreground color based on background hex luminance
 */
export function getContrastForeground(hex: string): { hex: string; hslStr: string } {
  let clean = hex.replace("#", "").trim();
  if (clean.length === 3) {
    clean = clean.split("").map((c) => c + c).join("");
  }
  if (clean.length !== 6) {
    return { hex: "#ffffff", hslStr: "0 0% 100%" };
  }

  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);

  // Perceived relative luminance (ITU-R BT.709)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  if (luminance > 0.6) {
    // Light background -> Dark text
    return { hex: "#05070e", hslStr: "227 47% 4%" };
  } else {
    // Dark background -> White text
    return { hex: "#ffffff", hslStr: "0 0% 100%" };
  }
}

/**
 * Applies a theme configuration to the DOM root and document dynamically
 */
export function applyTheme(theme: Partial<ThemeConfig>, persist = true): void {
  if (typeof document === "undefined") return;

  const primaryHex = theme.primaryHex || "#000000";
  const ringHex = theme.ringHex || primaryHex;
  const accentHex = theme.accentHex || primaryHex;

  // Validate hex format (must be 3 or 6 hex digits)
  const cleanHex = primaryHex.replace("#", "").trim();
  if (cleanHex.length !== 3 && cleanHex.length !== 6) {
    return;
  }

  const primaryHsl = hexToHsl(primaryHex);
  const ringHsl = hexToHsl(ringHex);
  const accentHsl = hexToHsl(accentHex);
  const fg = theme.primaryForegroundHex
    ? hexToHsl(theme.primaryForegroundHex)
    : hexToHsl(getContrastForeground(primaryHex).hex);

  const targets = [document.documentElement, document.body].filter(Boolean) as HTMLElement[];

  // 1. Direct CSS variable assignment on root and body
  targets.forEach((target) => {
    target.style.setProperty("--primary", primaryHsl.hslStr);
    target.style.setProperty("--primary-foreground", fg.hslStr);
    target.style.setProperty("--primary-glow", ringHsl.hslStr);
    target.style.setProperty("--ring", ringHsl.hslStr);
    target.style.setProperty("--accent", accentHsl.hslStr);
    target.style.setProperty("--accent-foreground", fg.hslStr);
    target.style.setProperty("--sidebar-primary", primaryHsl.hslStr);
    target.style.setProperty("--sidebar-primary-foreground", fg.hslStr);
    target.style.setProperty("--sidebar-ring", ringHsl.hslStr);

    target.style.setProperty("--primary-hex", primaryHex);
    target.style.setProperty("--ring-hex", ringHex);
    target.style.setProperty("--accent-hex", accentHex);
    target.style.setProperty("--gradient-primary", `linear-gradient(135deg, ${primaryHex}, ${ringHex})`);
  });

  // 2. High-specificity stylesheet injection
  // This guarantees dynamic theme styles apply across all selectors (.dark, :root, body)
  let styleEl = document.getElementById("driveflow-dynamic-theme") as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = "driveflow-dynamic-theme";
    document.head.appendChild(styleEl);
  }

  const isDarkOnyx = primaryHsl.l < 15;
  const darkPrimaryHsl = isDarkOnyx ? "0 0% 100%" : primaryHsl.hslStr;
  const darkPrimaryFgHsl = isDarkOnyx ? "0 0% 0%" : fg.hslStr;
  const darkPrimaryHex = isDarkOnyx ? "#ffffff" : primaryHex;
  const darkGradient = isDarkOnyx
    ? `linear-gradient(135deg, #1e293b, ${ringHex})`
    : `linear-gradient(135deg, ${primaryHex}, ${ringHex})`;

  styleEl.textContent = `
    :root, body {
      --primary: ${primaryHsl.hslStr} !important;
      --primary-foreground: ${fg.hslStr} !important;
      --primary-glow: ${ringHsl.hslStr} !important;
      --ring: ${ringHsl.hslStr} !important;
      --accent: ${accentHsl.hslStr} !important;
      --accent-foreground: ${fg.hslStr} !important;
      --sidebar-primary: ${primaryHsl.hslStr} !important;
      --sidebar-primary-foreground: ${fg.hslStr} !important;
      --sidebar-ring: ${ringHsl.hslStr} !important;
      --primary-hex: ${primaryHex} !important;
      --ring-hex: ${ringHex} !important;
      --accent-hex: ${accentHex} !important;
      --gradient-primary: linear-gradient(135deg, ${primaryHex}, ${ringHex}) !important;
    }
    .dark {
      --primary: ${darkPrimaryHsl} !important;
      --primary-foreground: ${darkPrimaryFgHsl} !important;
      --primary-glow: ${ringHsl.hslStr} !important;
      --ring: ${ringHsl.hslStr} !important;
      --accent: ${accentHsl.hslStr} !important;
      --accent-foreground: ${fg.hslStr} !important;
      --sidebar-primary: ${darkPrimaryHsl} !important;
      --sidebar-primary-foreground: ${darkPrimaryFgHsl} !important;
      --sidebar-ring: ${ringHsl.hslStr} !important;
      --primary-hex: ${darkPrimaryHex} !important;
      --ring-hex: ${ringHex} !important;
      --accent-hex: ${accentHex} !important;
      --gradient-primary: ${darkGradient} !important;
    }
    ::selection {
      background-color: hsl(${primaryHsl.hslStr} / 0.2) !important;
      color: hsl(${primaryHsl.hslStr}) !important;
    }
    .theme-primary-badge {
      background-color: hsl(${primaryHsl.hslStr} / 0.1) !important;
      color: hsl(${primaryHsl.hslStr}) !important;
      border: 1px solid hsl(${primaryHsl.hslStr} / 0.25) !important;
    }
  `;

  // 3. Set brand meta theme-color for mobile chrome / browsers
  let metaTheme = document.querySelector('meta[name="theme-color"]');
  if (!metaTheme) {
    metaTheme = document.createElement("meta");
    metaTheme.setAttribute("name", "theme-color");
    document.head.appendChild(metaTheme);
  }
  metaTheme.setAttribute("content", primaryHex);

  // 4. Persist to localStorage
  if (persist && typeof window !== "undefined") {
    try {
      const fullConfig: ThemeConfig = {
        id: theme.id || "custom",
        name: theme.name || "Custom Palette",
        primaryHex,
        primaryForegroundHex: theme.primaryForegroundHex || (fg.l > 50 ? "#ffffff" : "#05070e"),
        ringHex,
        accentHex,
        description: theme.description || "Custom workshop branding palette",
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fullConfig));
    } catch (e) {
      console.warn("[themeManager] Could not persist theme:", e);
    }
  }

  // 5. Dispatch global window event for components that need to respond live
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("driveflow-theme-changed", {
        detail: {
          id: theme.id || "custom",
          primaryHex,
          ringHex,
          accentHex,
          primaryHsl,
          ringHsl,
          fgHsl: fg,
        },
      })
    );
  }
}

/**
 * Retrieves the currently active theme from localStorage or fallback preset
 */
export function getActiveTheme(): ThemeConfig {
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.primaryHex) return parsed;
      }
    } catch {
      // ignore
    }
  }
  return THEME_PRESETS[0]; // Default HavDox Onyx
}

/**
 * Initializes theme on app startup from localStorage or server profile
 */
export function initTheme(serverProfileTheme?: any): void {
  if (typeof window === "undefined") return;

  // 1. If user previously selected a theme in localStorage, keep it active
  const hasLocal = Boolean(localStorage.getItem(STORAGE_KEY));
  if (hasLocal) {
    const active = getActiveTheme();
    applyTheme(active, false);
    return;
  }

  // 2. Prioritize server-saved theme if available and valid
  if (serverProfileTheme && serverProfileTheme.primaryHex) {
    applyTheme(serverProfileTheme, true);
    return;
  }

  // 3. Fallback to default preset
  const active = getActiveTheme();
  applyTheme(active, false);
}
