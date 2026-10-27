import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Car,
  Users,
  Wrench,
  FileText,
  BarChart3,
  Settings,
  Menu,
  X,
  Home
} from "lucide-react";
import { useCompanyProfile } from "@/hooks/useCompanyProfile";
import { BrandFooter } from "@/components/brand/BrandFooter";

const navigation = [
  { name: "Dashboard", href: "/", icon: Home },
  { name: "Vehicles", href: "/vehicles", icon: Car },
  { name: "Employees", href: "/employees", icon: Users },
  { name: "Services", href: "/services", icon: Wrench },
  { name: "Billing", href: "/billing", icon: FileText },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "Settings", href: "/settings", icon: Settings },
];

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { companyName } = useCompanyProfile();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border shadow-xs">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left Co-Branded Application Identity */}
            <div className="flex items-center space-x-3">
              <NavLink to="/" className="flex items-center gap-2.5 group">
                <div className="h-9 w-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0 shadow-sm transition-transform duration-200 group-hover:scale-105">
                  <img src="/logo-x.png" alt="Drive Flow" className="h-5 w-auto object-contain brightness-0 invert" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-display font-bold text-base tracking-tight text-foreground">
                    Drive Flow
                  </span>
                  <span className="text-muted-foreground/40 select-none">•</span>
                  <span className="text-xs font-medium text-muted-foreground">
                    Powered by HavDox
                  </span>
                </div>
              </NavLink>

              {companyName && companyName !== "Garage" && (
                <span className="hidden sm:inline-flex text-xs font-semibold px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/50 ml-2">
                  {companyName}
                </span>
              )}
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex space-x-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.href;
                return (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-display font-medium transition-all duration-200 flex items-center space-x-2 ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.name}</span>
                  </NavLink>
                );
              })}
            </nav>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="rounded-full"
              >
                {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-border bg-card">
            <div className="px-3 pt-2 pb-3 space-y-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.href;
                return (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    className={`block px-3 py-2 rounded-xl text-sm font-medium transition-colors flex items-center space-x-3 ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.name}</span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Official Clean Brand Footer */}
      <BrandFooter />
    </div>
  );
}