import React from "react";

interface BrandSignatureProps {
  className?: string;
  showLogo?: boolean;
  logoType?: "x" | "wordmark";
  size?: "sm" | "md" | "lg";
  align?: "left" | "center" | "right";
  linkTarget?: string;
  onOpenIntro?: () => void;
}

/**
 * Official HavDox Co-Branding Signature:
 * Drive Flow · Powered by HavDox
 * 
 * - Drive Flow is the primary, recognizable application label (Outfit font).
 * - Middle dot subtle separator.
 * - Understated "Powered by HavDox" (11-12px, medium weight, subtle letter-spacing).
 */
export const BrandSignature: React.FC<BrandSignatureProps> = ({
  className = "",
  showLogo = true,
  logoType = "x",
  size = "md",
  align = "left",
  linkTarget = "_blank",
  onOpenIntro,
}) => {
  const alignClass = {
    left: "justify-start text-left",
    center: "justify-center text-center",
    right: "justify-end text-right",
  }[align];

  const sizeConfig = {
    sm: {
      title: "text-xs sm:text-sm font-bold",
      brand: "text-[10px] sm:text-[11px]",
      logoHeight: "h-3.5 sm:h-4",
      gap: "gap-1.5",
    },
    md: {
      title: "text-sm sm:text-base font-bold",
      brand: "text-[11px] sm:text-[12px]",
      logoHeight: "h-4 sm:h-5",
      gap: "gap-2",
    },
    lg: {
      title: "text-lg sm:text-xl font-extrabold",
      brand: "text-[12px] sm:text-[13px]",
      logoHeight: "h-5 sm:h-6",
      gap: "gap-2.5",
    },
  }[size];

  return (
    <div className={`inline-flex items-center ${sizeConfig.gap} ${alignClass} ${className}`}>
      {showLogo && (
        <div
          className="relative shrink-0 flex items-center justify-center cursor-pointer select-none group"
          onClick={onOpenIntro}
          title="Drive Flow · Powered by HavDox"
        >
          {logoType === "x" ? (
            <img
              src="/logo-x.png"
              alt="HavDox Emblem"
              className={`${sizeConfig.logoHeight} w-auto object-contain transition-transform duration-200 group-hover:scale-105 dark:invert`}
            />
          ) : (
            <img
              src="/logo.png"
              alt="HavDox"
              className={`${sizeConfig.logoHeight} w-auto object-contain transition-transform duration-200 group-hover:scale-105 dark:invert`}
            />
          )}
        </div>
      )}

      <div className="flex items-center gap-1.5 flex-wrap">
        <span
          className={`font-display tracking-tight text-foreground ${sizeConfig.title}`}
        >
          Drive Flow
        </span>

        <span className="text-muted-foreground/40 text-xs select-none">•</span>

        <span
          className={`font-body font-medium tracking-wide text-muted-foreground ${sizeConfig.brand}`}
        >
          Powered by HavDox
        </span>
      </div>
    </div>
  );
};

export default BrandSignature;
