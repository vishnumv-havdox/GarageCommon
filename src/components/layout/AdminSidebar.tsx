import { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRequests } from "@/contexts/RequestsContext";
import { Shield, LogOut, Menu, Building2 } from "lucide-react";
import { navConfig } from "@/config/accessControl";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { UserProfileDialog } from "@/components/profile/UserProfileDialog";

// Re-export for backward compatibility
export { navConfig };

export function AdminSidebar() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [company, setCompany] = useState<any>(null);
  const { totalPending } = useRequests();

  useEffect(() => {
    const fetchProfile = async () => {
      const { data } = await supabase.from('company_profiles').select('company_name, logo_url').limit(1).maybeSingle();
      if (data) setCompany(data);
    };
    fetchProfile();
  }, []);

  // Filter nav items based on user role
  const filteredNav = navConfig.filter(
    item => item.roles.includes(user?.role || "customer")
  );

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-card">
      <div className="p-4 border-b">
        <NavLink to="/admin" className="flex items-center gap-3" onClick={() => setOpen(false)}>
          <div className="p-2 bg-primary/10 rounded-lg shrink-0">
            {company?.logo_url ? (
              <img src={company.logo_url} alt="Logo" className="h-6 w-6 object-contain" />
            ) : (
              <Shield className="h-6 w-6 text-primary" />
            )}
          </div>
          <div className="truncate">
            <h1 className="font-bold truncate text-sm uppercase">{company?.company_name || 'AMMA AUTO'}</h1>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Admin Panel</p>
          </div>
        </NavLink>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {filteredNav.map((item) => {
          const Icon = item.icon || Shield;
          const isLedgerPath = location.pathname === "/admin/ledger" || (location.pathname.startsWith('/admin/customers/') && location.pathname.endsWith('/ledger'));

          let isActive = false;
          if (item.label === "Ledger") {
            isActive = isLedgerPath;
          } else if (item.label === "Customers") {
            isActive = location.pathname.startsWith('/admin/customers') && !isLedgerPath;
          } else if (item.label === "Financials") {
            // Financials might point to invoice-analytics general
            isActive = location.pathname === "/admin/invoice-analytics";
          } else {
            isActive = item.end
              ? location.pathname === item.path
              : location.pathname.startsWith(item.path);
          }

          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors relative ${isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
            >
              <Icon className="h-5 w-5" />
              <span className="flex-1">{item.label}</span>
              {item.label === "Inbox" && totalPending > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                  {totalPending}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="p-4 border-t mt-auto">
        <div
          className="flex items-center gap-3 mb-3 cursor-pointer hover:bg-muted/50 p-2 rounded-lg transition-colors"
          onClick={() => setProfileOpen(true)}
        >
          <Badge variant="default">{user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'User'}</Badge>
          <span className="text-sm truncate max-w-[120px]">
            {user?.full_name || user?.email || "User"}
          </span>
        </div>
        <Button
          onClick={signOut}
          variant="outline"
          className="w-full"
          size="sm"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </Button>
      </div>
      <UserProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </div>
  );

  return (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden flex items-center justify-between p-4 border-b bg-card w-full">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            {company?.logo_url ? (
              <img src={company.logo_url} alt="Logo" className="h-5 w-5 object-contain" />
            ) : (
              <Shield className="h-5 w-5 text-primary" />
            )}
          </div>
          <span className="font-bold truncate max-w-[150px] uppercase text-sm">
            {company?.company_name || 'Admin Panel'}
          </span>
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-72">
            <SidebarContent />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Sidebar - Fixed Width */}
      <aside className="hidden lg:flex w-64 min-h-screen border-r flex-col sticky top-0 h-screen overflow-y-auto">
        <SidebarContent />
      </aside>
    </>
  );
}

