import React, { useState } from "react";
import { useLocation } from "react-router-dom";
import { Gauge, Clock, ChevronUp } from "lucide-react";
import { GarageClock } from "./GarageClock";

interface GlobalHUDProps {
    children: React.ReactNode;
}

export const GlobalHUD: React.FC<GlobalHUDProps> = ({ children }) => {
    const location = useLocation();
    const [isOpen, setIsOpen] = useState(false);

    // Don't show the floating HUD on the dashboard, as it has its own fixed clock
    const isDashboard = location.pathname === "/admin";
    const isAdmin = location.pathname.startsWith("/admin");

    if (!isAdmin) return <>{children}</>;

    return (
        <div className="relative min-h-screen">
            {/* Floating Trigger - Top Center */}
            {!isDashboard && (
                <div className="fixed top-0 left-1/2 -translate-x-1/2 z-[200] transition-all duration-500 ease-in-out pointer-events-none">
                    <button
                        onClick={() => setIsOpen(!isOpen)}
                        className={`flex items-center justify-center gap-2 px-6 py-2 bg-slate-950 text-white rounded-b-2xl border-x border-b border-primary/20 shadow-2xl transition-all duration-300 hover:py-3 hover:bg-black pointer-events-auto group`}
                    >
                        {isOpen ? (
                            <ChevronUp className="w-5 h-5 text-primary animate-bounce" />
                        ) : (
                            <>
                                <Gauge className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
                                <Clock className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
                            </>
                        )}
                    </button>
                </div>
            )}

            {/* Expanded HUD - No Background, No Blur, Just Clock Items */}
            {!isDashboard && (
                <div
                    className={`fixed top-0 left-0 right-0 z-[190] transition-all duration-700 cubic-bezier(0.16, 1, 0.3, 1) transform ${isOpen ? 'translate-y-0 pointer-events-none' : 'translate-y-[-100%] pointer-events-none'}`}
                >
                    {/* Main Content Container - Pointer events only for the clock itself */}
                    <div className="relative flex flex-col items-center py-12 focus:outline-none">
                        <div className={`scale-110 md:scale-125 transform transition-all duration-700 p-4 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0'}`}>
                            <GarageClock />
                        </div>
                    </div>
                </div>
            )}

            {/* Page Content Wrapper */}
            <div className="relative z-0">
                {children}
            </div>
        </div>
    );
};
