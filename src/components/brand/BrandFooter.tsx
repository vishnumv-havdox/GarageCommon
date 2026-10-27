import React from "react";
import { BrandSignature } from "./BrandSignature";

interface BrandFooterProps {
  className?: string;
  compact?: boolean;
  onOpenIntro?: () => void;
}

/**
 * Official HavDox Brand Footer
 * 
 * Required elements:
 * - Drive Flow · Powered by HavDox
 * - Dynamic year copyright
 */
export const BrandFooter: React.FC<BrandFooterProps> = ({
  className = "",
  compact = false,
  onOpenIntro,
}) => {
  const currentYear = new Date().getFullYear();

  if (compact) {
    return (
      <footer
        className={`w-full py-3 px-4 border-t border-border/60 bg-card/60 backdrop-blur-xs text-[11px] text-muted-foreground flex flex-col sm:flex-row items-center justify-between gap-2 ${className}`}
      >
        <BrandSignature size="sm" onOpenIntro={onOpenIntro} />
        <div className="flex items-center gap-3">
          <span className="hidden md:inline italic font-medium text-muted-foreground/80">
            Imagine. Build. Go Beyond.
          </span>
          <span className="hidden md:inline text-border">•</span>
          <span>&copy; {currentYear} HavDox. All rights reserved.</span>
        </div>
      </footer>
    );
  }

  return (
    <footer
      className={`w-full mt-auto border-t border-border/70 bg-card/40 backdrop-blur-sm py-6 px-4 sm:px-6 lg:px-8 text-xs transition-colors ${className}`}
    >
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Brand Co-Signature */}
        <div className="flex items-center gap-3">
          <BrandSignature size="md" />
        </div>

        {/* Dynamic Copyright Attribution */}
        <div className="text-muted-foreground text-xs flex items-center gap-1.5">
          <span>&copy; {currentYear} Drive Flow · Powered by HavDox.</span>
          <span className="hidden sm:inline">All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
};

export default BrandFooter;
