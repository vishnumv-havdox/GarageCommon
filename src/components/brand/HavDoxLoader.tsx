import React from "react";
import { useCompanyProfile } from "@/hooks/useCompanyProfile";
import { cn } from "@/lib/utils";

interface HavDoxLoaderProps {
  /**
   * Layout variant:
   * - 'fullscreen': Full-screen overlay for route transitions & initial auth resolution
   * - 'section': Centered block loader for pages, tables, and views
   * - 'inline': Compact inline loader for dialogs and small cards
   */
  variant?: "fullscreen" | "section" | "inline";
  /** Custom action or status text to display (e.g. "Loading vehicles...", "Syncing records...") */
  message?: string;
  /** Explicit garage name override (defaults to active garage profile) */
  garageName?: string;
  /** Optional container class name */
  className?: string;
}

/**
 * HavDoxLoader
 * 
 * Official HavDox brand loader used across all screens, views, and data transitions.
 * Displays the HavDox emblem, Garage Name, and "Drive Flow · Powered by HavDox" brand.
 */
export const HavDoxLoader: React.FC<HavDoxLoaderProps> = ({
  variant = "fullscreen",
  message,
  garageName: explicitGarageName,
  className,
}) => {
  const { companyName } = useCompanyProfile();
  const garageName = explicitGarageName || companyName || "Amma Auto Garage";

  const isFullscreen = variant === "fullscreen";
  const isInline = variant === "inline";

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center select-none text-foreground",
        isFullscreen &&
          "fixed inset-0 z-50 min-h-screen w-screen bg-background/95 backdrop-blur-md transition-opacity duration-300",
        variant === "section" && "w-full py-12 px-4 my-auto min-h-[220px]",
        isInline && "w-full py-6 px-2 min-h-[140px]",
        className
      )}
      role="status"
      aria-label={`Loading ${message || garageName}`}
    >
      {/* Animated HavDox Insignia Container */}
      <div className="relative flex items-center justify-center mb-4">
        {/* Ambient radial aura glow */}
        <div
          className={cn(
            "absolute rounded-full bg-primary/10 blur-xl animate-pulse pointer-events-none",
            isFullscreen ? "w-28 h-28" : isInline ? "w-14 h-14" : "w-20 h-20"
          )}
        />

        {/* Outer orbital spin ring */}
        <div
          className={cn(
            "rounded-full border border-dashed border-primary/30 animate-[spin_6s_linear_infinite]",
            isFullscreen ? "w-20 h-20" : isInline ? "w-11 h-11" : "w-14 h-14"
          )}
        />

        {/* High-speed glowing accent sweep ring */}
        <div
          className={cn(
            "absolute rounded-full border-2 border-transparent border-t-primary border-r-primary/50 animate-[spin_1.2s_cubic-bezier(0.4,0,0.2,1)_infinite]",
            isFullscreen ? "w-16 h-16" : isInline ? "w-9 h-9" : "w-12 h-12"
          )}
        />

        {/* Center HavDox "X" Emblem Icon */}
        <div
          className={cn(
            "absolute rounded-xl bg-foreground text-background flex items-center justify-center shadow-lg transform transition-transform duration-300",
            isFullscreen ? "w-10 h-10" : isInline ? "w-6 h-6 rounded-md" : "w-8 h-8 rounded-lg"
          )}
        >
          <img
            src="/logo-x.png"
            alt="Drive Flow"
            className={cn(
              "object-contain filter invert dark:invert-0",
              isFullscreen ? "h-6 w-6" : isInline ? "h-3.5 w-3.5" : "h-5 w-5"
            )}
          />
        </div>
      </div>

      {/* Brand & Garage Information Hierarchy */}
      <div className="text-center space-y-1 max-w-sm px-4 animate-in fade-in duration-500">
        {/* Garage Name */}
        <h3
          className={cn(
            "font-display font-bold tracking-tight text-foreground line-clamp-1",
            isFullscreen ? "text-lg sm:text-xl" : isInline ? "text-xs font-semibold" : "text-sm sm:text-base"
          )}
        >
          {garageName}
        </h3>

        {/* Software & Brand Attribution */}
        <div
          className={cn(
            "flex items-center justify-center gap-1.5 font-medium text-muted-foreground",
            isFullscreen ? "text-xs tracking-wider uppercase" : isInline ? "text-[10px]" : "text-xs"
          )}
        >
          <span className="font-semibold text-foreground">Drive Flow</span>
          <span>•</span>
          <span>Powered by HavDox</span>
        </div>

        {/* Optional Action / Status Message */}
        {message && (
          <p
            className={cn(
              "text-muted-foreground/80 font-normal italic animate-pulse pt-0.5",
              isFullscreen ? "text-xs" : "text-[11px]"
            )}
          >
            {message}
          </p>
        )}
      </div>
    </div>
  );
};

export default HavDoxLoader;
