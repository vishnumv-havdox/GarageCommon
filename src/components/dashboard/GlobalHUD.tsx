import React from "react";

interface GlobalHUDProps {
  children: React.ReactNode;
}

/**
 * GlobalHUD previously rendered a floating black top notch that blocked
 * page breadcrumbs and titles. Following the UI/UX Redesign Blueprint,
 * notifications have been migrated to the standard topbar NotificationBell,
 * and GlobalHUD serves as a transparent pass-through container.
 */
export const GlobalHUD: React.FC<GlobalHUDProps> = ({ children }) => {
  return <div className="relative min-h-screen">{children}</div>;
};

export default GlobalHUD;
