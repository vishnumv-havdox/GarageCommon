import { useLocation, NavLink } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";
import { BrandFooter } from "@/components/brand/BrandFooter";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col justify-between bg-background text-foreground">
      {/* Header */}
      <header className="py-4 px-6 sm:px-10 flex items-center justify-between border-b border-border/60">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-black dark:bg-white text-white dark:text-black flex items-center justify-center shadow-xs">
            <img src="/logo-x.png" alt="HavDox" className="h-4 w-auto object-contain invert dark:invert-0" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-sm tracking-tight text-foreground">
              Drive Flow
            </span>
            <span className="text-muted-foreground/40 text-xs">•</span>
            <span className="text-xs font-medium text-muted-foreground">
              Powered by HavDox
            </span>
          </div>
        </div>
      </header>

      {/* 404 Body */}
      <main className="flex-1 flex items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-6">
          <div className="space-y-3">
            <span className="font-display font-extrabold text-7xl sm:text-8xl tracking-tight text-foreground select-none">
              404
            </span>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Route Unavailable
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              The requested address cannot be located within the Drive Flow application ecosystem.
            </p>
          </div>

          <div>
            <Button
              asChild
              className="rounded-full px-6 py-2.5 shadow-sm font-display font-medium"
            >
              <NavLink to="/dashboard">
                <Home className="h-4 w-4 mr-2" />
                Return to Workspace
              </NavLink>
            </Button>
          </div>
        </div>
      </main>

      {/* Official HavDox Brand Footer */}
      <BrandFooter />
    </div>
  );
};

export default NotFound;