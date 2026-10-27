import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HavDoxIntro } from "./HavDoxIntro";
import { useCompanyProfile } from "@/hooks/useCompanyProfile";

interface LoginIntroTransitionProps {
  onComplete: () => void;
  userName?: string;
  garageName?: string;
}

/**
 * LoginIntroTransition
 * 
 * Official HavDox breakthrough intro animation upon successful login.
 * Displays personalized greeting:
 * - "Welcome, {userName}"
 * - Garage Name: "{garageName}"
 * - "Drive Flow"
 * - "Powered by HavDox"
 * 
 * This personalized welcome is strictly displayed ONLY in the login intro transition.
 */
export const LoginIntroTransition: React.FC<LoginIntroTransitionProps> = ({
  onComplete,
  userName: explicitUserName,
  garageName: explicitGarageName,
}) => {
  const [hasFinished, setHasFinished] = useState(false);
  const { companyName } = useCompanyProfile();

  const garageName = explicitGarageName || companyName || "Amma Auto Garage";
  const userName = explicitUserName?.trim() || "User";

  const handleFinish = React.useCallback(() => {
    if (hasFinished) return;
    setHasFinished(true);
    onComplete();
  }, [hasFinished, onComplete]);

  useEffect(() => {
    // Keyboard listener: Escape key skips the intro if user is in a hurry
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleFinish();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    // Guaranteed safety timeout (4.8 seconds) ensures user is smoothly transitioned into dashboard
    const safetyTimer = setTimeout(() => {
      handleFinish();
    }, 4800);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      clearTimeout(safetyTimer);
    };
  }, [handleFinish]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-white text-black transition-opacity duration-500 animate-in fade-in overflow-hidden select-none"
      role="dialog"
      aria-label={`Welcome to Drive Flow, ${userName}`}
    >
      {/* Top Bar with Brand Badge and Skip Button */}
      <header className="w-full px-6 py-5 flex items-center justify-between z-30">
        {/* Subtle Garage & Software Attribution Badge */}
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/5 border border-black/10 text-xs font-medium text-neutral-800 shadow-xs backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-700">
          <span className="font-display font-bold text-neutral-900">Drive Flow</span>
          <span className="text-neutral-400">•</span>
          <span className="font-semibold text-neutral-700">HavDox</span>
          <span className="text-neutral-400">•</span>
          <span className="text-neutral-600 truncate max-w-[180px] sm:max-w-xs">{garageName}</span>
        </div>

        {/* Skip button in top right */}
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            handleFinish();
          }}
          className="h-8 px-3 rounded-full text-xs font-medium bg-black/5 hover:bg-black/10 text-neutral-800 backdrop-blur-md transition-all border border-black/10 shadow-xs"
        >
          Skip Intro
          <X className="h-3.5 w-3.5 ml-1.5 opacity-80" />
        </Button>
      </header>

      {/* Center: HavDox Vector Breakthrough Intro Animation */}
      <main className="relative w-full flex-1 flex flex-col items-center justify-center -mt-6">
        <div className="w-full max-w-4xl flex items-center justify-center">
          <HavDoxIntro
            onAnimationComplete={handleFinish}
            showContent={false}
            interactive={false}
          />
        </div>

        {/* Personalized Welcome Banner (Strictly shown ONLY in Login Intro) */}
        <div className="text-center px-4 -mt-2 space-y-1.5 z-20 animate-in fade-in slide-up duration-1000 fill-mode-both">
          <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-neutral-900">
            Welcome, <span className="text-neutral-950 underline decoration-primary/40 underline-offset-4">{userName}</span>
          </h2>
          <p className="text-sm sm:text-base font-semibold text-neutral-600 flex items-center justify-center gap-2">
            <span>{garageName}</span>
            <span className="text-neutral-300">•</span>
            <span className="text-neutral-900 font-bold">Drive Flow</span>
          </p>
          <p className="text-xs text-neutral-400 font-medium tracking-wide">
            Powered by HavDox · Workshop Operations Suite
          </p>
        </div>
      </main>

      {/* Bottom Attribution Footer */}
      <footer className="w-full pb-6 text-center text-xs text-neutral-400 tracking-wider font-display z-20">
        Drive Flow · Powered by HavDox
      </footer>
    </div>
  );
};

export default LoginIntroTransition;
