import { useState, useEffect } from "react";

/**
 * Theme & UI Colors Manager for Drive Flow
 * 
 * Provides live theme switching, custom hex color palettes, contrast computation,
 * dark/light interface mode control, local persistence, and database synchronization.
 */

export type ColorMode = "light" | "dark" | "system";

export interface ThemeConfig {
  id: string;
  name: string;
  primaryHex: string;
  primaryForegroundHex?: string;
  accentHex?: string;
  ringHex?: string;
  description: string;
  badge?: string;
  mode?: ColorMode;
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
export const MODE_STORAGE_KEY = "driveflow_color_mode";

let mediaListenerAttached = false;

/**
 * Returns the currently configured color mode: 'light', 'dark', or 'system'
 */
export function getColorMode(): ColorMode {
  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem(MODE_STORAGE_KEY) as ColorMode | null;
      if (saved === "light" || saved === "dark" || saved === "system") {
        return saved;
      }
    } catch {}
  }
  return "light";
}

/**
 * Determines whether dark mode is currently active based on mode and OS preferences
 */
export function isDarkModeActive(): boolean {
  if (typeof window === "undefined") return false;
  const mode = getColorMode();
  if (mode === "dark") return true;
  if (mode === "light") return false;
  return Boolean(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
}

/**
 * Executes a DOM theme/mode update with seamless zero-lag synchronization.
 * If View Transitions are supported, it disables internal element transitions during
 * snapshot capture and runs a silky-smooth GPU crossfade.
 * If View Transitions are not supported, it disables transitions for 1 frame
 * to ensure atomic, simultaneous switching across all UI areas.
 */
export function executeSeamlessThemeUpdate(updateFn: () => void, animate = true): void {
  if (typeof document === "undefined") {
    updateFn();
    return;
  }

  const root = document.documentElement;

  if (!animate) {
    updateFn();
    return;
  }

  const supportsViewTransition =
    "startViewTransition" in document &&
    typeof window !== "undefined" &&
    window.matchMedia &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (supportsViewTransition) {
    // Disable internal transitions so screenshot snapshot 2 is captured in 100% complete state
    root.classList.add("theme-transitioning");

    try {
      const transition = (document as any).startViewTransition(() => {
        updateFn();
      });

      transition.finished.finally(() => {
        root.classList.remove("theme-transitioning");
      });
    } catch {
      root.classList.remove("theme-transitioning");
      updateFn();
    }
  } else {
    // Fallback: Atomic 1-frame switch without staggered lag
    root.classList.add("theme-transitioning");
    updateFn();
    void root.offsetHeight; // force style flush
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        root.classList.remove("theme-transitioning");
      });
    });
  }
}

/**
 * Applies or switches the interface color mode ('light' | 'dark' | 'system')
 */
export function setColorMode(mode: ColorMode, persist = true, animate = true): void {
  if (typeof document === "undefined") return;

  const performUpdate = () => {
    const isDark =
      mode === "dark" ||
      (mode === "system" &&
        typeof window !== "undefined" &&
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);

    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    document.documentElement.setAttribute("data-theme-mode", mode);

    // Synchronize active brand theme variables for current mode (e.g. Onyx dark inversion)
    const activeTheme = getActiveTheme();
    syncThemeVariables(activeTheme, isDark);

    if (persist && typeof window !== "undefined") {
      try {
        localStorage.setItem(MODE_STORAGE_KEY, mode);
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          parsed.mode = mode;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
        }
      } catch (e) {
        console.warn("[themeManager] Could not save color mode:", e);
      }
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("driveflow-colormode-changed", {
          detail: { mode, isDark },
        })
      );
    }
  };

  executeSeamlessThemeUpdate(performUpdate, animate);
}

/**
 * Toggles between Light and Dark modes quickly
 */
export function toggleThemeMode(): ColorMode {
  const current = getColorMode();
  const next: ColorMode = current === "dark" ? "light" : "dark";
  setColorMode(next, true);
  return next;
}

/**
 * React hook to observe and toggle color mode live
 */
export function useColorMode() {
  const [mode, setModeState] = useState<ColorMode>(() => getColorMode());
  const [isDark, setIsDarkState] = useState<boolean>(() => isDarkModeActive());

  useEffect(() => {
    const handleModeChange = (e: any) => {
      const newMode = e.detail?.mode || getColorMode();
      setModeState(newMode);
      setIsDarkState(typeof e.detail?.isDark === "boolean" ? e.detail.isDark : isDarkModeActive());
    };

    window.addEventListener("driveflow-colormode-changed", handleModeChange);
    return () => {
      window.removeEventListener("driveflow-colormode-changed", handleModeChange);
    };
  }, []);

  const setMode = (newMode: ColorMode) => {
    setColorMode(newMode, true);
    setModeState(newMode);
    setIsDarkState(
      newMode === "dark" ||
        (newMode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)
    );
  };

  const toggle = () => {
    const next = toggleThemeMode();
    setModeState(next);
    setIsDarkState(next === "dark");
  };

  return { mode, isDark, setMode, toggle };
}

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
 * Synchronizes active brand theme variables for current mode (handles Onyx dark inversion cleanly)
 */
export function syncThemeVariables(theme: Partial<ThemeConfig>, isDark: boolean): void {
  if (typeof document === "undefined") return;

  const primaryHex = theme.primaryHex || "#000000";
  const ringHex = theme.ringHex || primaryHex;
  const accentHex = theme.accentHex || primaryHex;

  const cleanHex = primaryHex.replace("#", "").trim();
  if (cleanHex.length !== 3 && cleanHex.length !== 6) return;

  const primaryHsl = hexToHsl(primaryHex);
  const ringHsl = hexToHsl(ringHex);
  const accentHsl = hexToHsl(accentHex);
  const fg = theme.primaryForegroundHex
    ? hexToHsl(theme.primaryForegroundHex)
    : hexToHsl(getContrastForeground(primaryHex).hex);

  // Check if this is the Onyx obsidian theme
  const isOnyx =
    theme.id === "havdox-onyx" ||
    primaryHex.toLowerCase() === "#000000" ||
    primaryHex.toLowerCase() === "#000";

  // In dark mode, pure Onyx inverts to white with black text for high contrast.
  // All other vibrant themes (Amber, Cobalt, Emerald, Crimson, Violet, Cyan, Orange, Slate)
  // preserve their authentic brand hue in both light and dark modes!
  const effectivePrimaryHsl = isDark && isOnyx ? "0 0% 100%" : primaryHsl.hslStr;
  const effectiveFgHsl = isDark && isOnyx ? "0 0% 0%" : fg.hslStr;
  const effectivePrimaryHex = isDark && isOnyx ? "#ffffff" : primaryHex;

  const root = document.documentElement;

  // Clean up any stale inline --accent styles so shadcn dropdowns/selects inherit clean theme tokens
  root.style.removeProperty("--accent");
  root.style.removeProperty("--accent-foreground");

  // Direct CSS variable assignments for brand color tokens
  root.style.setProperty("--primary", effectivePrimaryHsl);
  root.style.setProperty("--primary-foreground", effectiveFgHsl);
  root.style.setProperty("--primary-glow", ringHsl.hslStr);
  root.style.setProperty("--ring", ringHsl.hslStr);
  root.style.setProperty("--sidebar-primary", effectivePrimaryHsl);
  root.style.setProperty("--sidebar-primary-foreground", effectiveFgHsl);
  root.style.setProperty("--sidebar-ring", ringHsl.hslStr);

  root.style.setProperty("--primary-hex", effectivePrimaryHex);
  root.style.setProperty("--ring-hex", ringHex);
  root.style.setProperty("--accent-hex", accentHex);

  const gradient =
    isDark && isOnyx
      ? `linear-gradient(135deg, #1e293b, ${ringHex})`
      : `linear-gradient(135deg, ${primaryHex}, ${ringHex})`;
  root.style.setProperty("--gradient-primary", gradient);
}

/**
 * Applies a theme configuration to the DOM root and document dynamically
 */
export function applyTheme(theme: Partial<ThemeConfig>, persist = true, animate = true): void {
  if (typeof document === "undefined") return;

  const primaryHex = theme.primaryHex || "#000000";
  const ringHex = theme.ringHex || primaryHex;
  const accentHex = theme.accentHex || primaryHex;

  // Validate hex format (must be 3 or 6 hex digits)
  const cleanHex = primaryHex.replace("#", "").trim();
  if (cleanHex.length !== 3 && cleanHex.length !== 6) {
    return;
  }

  const performApply = () => {
    const fullConfig: ThemeConfig = {
      id: theme.id || "custom",
      name: theme.name || "Custom Palette",
      primaryHex,
      primaryForegroundHex: theme.primaryForegroundHex,
      ringHex,
      accentHex,
      description: theme.description || "Custom workshop branding palette",
      badge: theme.badge,
      mode: theme.mode || getColorMode(),
    };

    // 1. Persist to localStorage FIRST so any subsequent getters read the latest theme!
    if (persist && typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(fullConfig));
      } catch (e) {
        console.warn("[themeManager] Could not persist theme:", e);
      }
    }

    // 2. Synchronize theme variables for the new theme
    const isDark = isDarkModeActive();
    syncThemeVariables(fullConfig, isDark);

    // 3. Clean up any legacy dynamic style elements if present
    const existingStyle = document.getElementById("driveflow-dynamic-theme");
    if (existingStyle) {
      existingStyle.remove();
    }

    // 4. Set brand meta theme-color for mobile chrome / browsers
    let metaTheme = document.querySelector('meta[name="theme-color"]');
    if (!metaTheme) {
      metaTheme = document.createElement("meta");
      metaTheme.setAttribute("name", "theme-color");
      document.head.appendChild(metaTheme);
    }
    metaTheme.setAttribute("content", primaryHex);

    // 5. Update mode ONLY if explicitly specified and different from active mode
    if (theme.mode && theme.mode !== getColorMode()) {
      setColorMode(theme.mode, persist, false);
    }

    // 6. Dispatch global window event for components that need to respond live
    if (typeof window !== "undefined") {
      const primaryHsl = hexToHsl(primaryHex);
      const ringHsl = hexToHsl(ringHex);
      const fg = fullConfig.primaryForegroundHex
        ? hexToHsl(fullConfig.primaryForegroundHex)
        : hexToHsl(getContrastForeground(primaryHex).hex);

      window.dispatchEvent(
        new CustomEvent("driveflow-theme-changed", {
          detail: {
            id: fullConfig.id,
            name: fullConfig.name,
            primaryHex,
            ringHex,
            accentHex,
            primaryHsl,
            ringHsl,
            fgHsl: fg,
            mode: fullConfig.mode,
          },
        })
      );
    }
  };

  if (animate) {
    executeSeamlessThemeUpdate(performApply, true);
  } else {
    performApply();
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
 * Initializes theme and color mode on app startup from localStorage or server profile
 */
export function initTheme(serverProfileTheme?: any): void {
  if (typeof window === "undefined") return;

  // 1. Setup OS prefers-color-scheme media query listener once
  if (!mediaListenerAttached && window.matchMedia) {
    mediaListenerAttached = true;
    try {
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      const listener = () => {
        if (getColorMode() === "system") {
          setColorMode("system", false);
        }
      };
      if (media.addEventListener) {
        media.addEventListener("change", listener);
      } else if ((media as any).addListener) {
        (media as any).addListener(listener);
      }
    } catch {}
  }

  // 2. Initialize color mode (localStorage or server profile)
  const localMode = localStorage.getItem(MODE_STORAGE_KEY) as ColorMode | null;
  const serverMode = (serverProfileTheme?.mode || serverProfileTheme?.theme_settings?.mode) as ColorMode | null;
  const initialMode = localMode || serverMode || "light";
  setColorMode(initialMode, false);

  // 3. If user previously selected a theme in localStorage, keep it active
  const hasLocal = Boolean(localStorage.getItem(STORAGE_KEY));
  if (hasLocal) {
    const active = getActiveTheme();
    applyTheme(active, false);
    return;
  }

  // 4. Prioritize server-saved theme if available and valid
  if (serverProfileTheme && serverProfileTheme.primaryHex) {
    applyTheme(serverProfileTheme, true);
    return;
  }

  // 5. Fallback to default preset
  const active = getActiveTheme();
  applyTheme(active, false);
}
