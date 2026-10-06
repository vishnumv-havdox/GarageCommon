import { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth, type UserRole } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRequests } from "@/contexts/RequestsContext";
import { 
  Shield, LogOut, Menu, Building2, ChevronDown, ChevronRight,
  Inbox, Calendar, FileText, Activity, Users, Truck, Package, QrCode,
  Receipt, BookText, BarChart3, PieChart, Settings, CalendarCheck,
  Banknote, Wrench, BookOpen, Briefcase, User, UserCog
} from "lucide-react";
import { navConfig } from "@/config/accessControl";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { UserProfileDialog } from "@/components/profile/UserProfileDialog";

// Re-export for backward compatibility
export { navConfig };

// Define grouped sidebar structure
const sidebarGroups = [
  {
    type: "link" as const,
    label: "Dashboard",
    path: "/dashboard",
    icon: Shield,
    roles: ["admin", "staff", "customer"] as UserRole[],
    end: true
  },
  {
    type: "group" as const,
    label: "Operations",
    icon: Activity,
    roles: ["admin", "manager", "staff"] as UserRole[],
    subItems: [
      { label: "Inbox", path: "/admin/requests", icon: Inbox, roles: ["admin", "manager"] as UserRole[] },
      { label: "Appointments", path: "/admin/appointments", icon: Calendar, roles: ["admin", "manager"] as UserRole[] },
      { label: "Work Orders", path: "/admin/work-orders", icon: FileText, roles: ["admin", "manager"] as UserRole[] },
      { label: "Progress", path: "/admin/progress", icon: Activity, roles: ["admin", "manager", "staff"] as UserRole[] },
    ]
  },
  {
    type: "group" as const,
    label: "Fleet & CRM",
    icon: Truck,
    roles: ["admin", "manager"] as UserRole[],
    subItems: [
      { label: "Customers", path: "/admin/customers", icon: Users, roles: ["admin", "manager"] as UserRole[] },
      { label: "Vehicles", path: "/admin/vehicles", icon: Truck, roles: ["admin", "manager"] as UserRole[] },
      { label: "Services Master", path: "/admin/services", icon: Wrench, roles: ["admin", "manager"] as UserRole[] },
      { label: "Booking Catalog", path: "/admin/booking-catalog", icon: BookOpen, roles: ["admin", "manager"] as UserRole[] },
    ]
  },
  {
    type: "group" as const,
    label: "Inventory Room",
    icon: Package,
    roles: ["admin", "manager"] as UserRole[],
    subItems: [
      { label: "Stock Master", path: "/admin/inventory", icon: Package, roles: ["admin"] as UserRole[] },
      { label: "Scanning Kiosk", path: "/inventory/room", icon: QrCode, roles: ["admin", "manager", "staff"] as UserRole[] },
    ]
  },
  {
    type: "group" as const,
    label: "Billing & Finance",
    icon: Receipt,
    roles: ["admin", "manager", "staff"] as UserRole[],
    subItems: [
      { label: "Invoices", path: "/admin/invoices", icon: Receipt, roles: ["admin", "manager", "staff"] as UserRole[] },
      { label: "Ledger", path: "/admin/ledger", icon: BookText, roles: ["admin", "manager"] as UserRole[] },
      { label: "Salary & Payouts", path: "/admin/salary", icon: Banknote, roles: ["admin", "manager"] as UserRole[] },
      { label: "Tally Integration", path: "/admin/tally", icon: Receipt, roles: ["admin", "manager"] as UserRole[] },
    ]
  },
  {
    type: "group" as const,
    label: "Analytics",
    icon: BarChart3,
    roles: ["admin", "manager"] as UserRole[],
    subItems: [
      { label: "Performance", path: "/admin/analytics", icon: BarChart3, roles: ["admin"] as UserRole[] },
      { label: "Financials", path: "/admin/invoice-analytics", icon: BarChart3, roles: ["admin", "manager"] as UserRole[] },
      { label: "360° Analytics", path: "/admin/analytics-dashboard", icon: PieChart, roles: ["admin", "manager"] as UserRole[] },
    ]
  },
  {
    type: "group" as const,
    label: "Workforce",
    icon: UserCog,
    roles: ["admin", "manager"] as UserRole[],
    subItems: [
      { label: "Employees", path: "/admin/employees", icon: UserCog, roles: ["admin"] as UserRole[] },
      { label: "Attendance Control", path: "/admin/attendance", icon: CalendarCheck, roles: ["admin", "manager"] as UserRole[] },
    ]
  },
  {
    type: "group" as const,
    label: "System Settings",
    icon: Settings,
    roles: ["admin", "manager"] as UserRole[],
    subItems: [
      { label: "User Accounts", path: "/admin/users", icon: Shield, roles: ["admin"] as UserRole[] },
      { label: "Access Control", path: "/admin/access-control", icon: Shield, roles: ["admin"] as UserRole[] },
      { label: "Configuration", path: "/admin/settings", icon: Settings, roles: ["admin", "manager"] as UserRole[] },
    ]
  },
  {
    type: "group" as const,
    label: "Staff Portal",
    icon: Briefcase,
    roles: ["staff"] as UserRole[],
    subItems: [
      { label: "My Dashboard", path: "/staff", icon: Briefcase, roles: ["staff"] as UserRole[], end: true },
      { label: "My Attendance", path: "/staff/attendance", icon: CalendarCheck, roles: ["staff"] as UserRole[], end: true },
    ]
  },
  {
    type: "group" as const,
    label: "Customer Portal",
    icon: User,
    roles: ["customer"] as UserRole[],
    subItems: [
      { label: "My Portal", path: "/customer", icon: User, roles: ["customer"] as UserRole[], end: true },
    ]
  }
];

export function AdminSidebar() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [company, setCompany] = useState<any>(null);
  const { totalPending } = useRequests();
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const fetchProfile = async () => {
      const { data } = await supabase.from('company_profiles').select('company_name, logo_url').limit(1).maybeSingle();
      if (data) setCompany(data);
    };
    fetchProfile();
  }, []);

  const isSubItemActive = (sub: any) => {
    const isLedgerPath = location.pathname === "/admin/ledger" || (location.pathname.startsWith('/admin/customers/') && location.pathname.endsWith('/ledger'));
    if (sub.label === "Ledger") return isLedgerPath;
    if (sub.label === "Customers") return location.pathname.startsWith('/admin/customers') && !isLedgerPath;
    if (sub.label === "Financials") return location.pathname === "/admin/invoice-analytics";
    return sub.end
      ? location.pathname === sub.path
      : location.pathname.startsWith(sub.path);
  };

  // Auto-expand group if child is active
  useEffect(() => {
    const newExpanded = { ...expandedGroups };
    let changed = false;
    sidebarGroups.forEach(group => {
      if (group.type === "group" && group.subItems) {
        const hasActiveChild = group.subItems.some(sub => isSubItemActive(sub));
        if (hasActiveChild && !newExpanded[group.label]) {
          newExpanded[group.label] = true;
          changed = true;
        }
      }
    });
    if (changed) {
      setExpandedGroups(newExpanded);
    }
  }, [location.pathname]);

  const toggleGroup = (groupLabel: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupLabel]: !prev[groupLabel]
    }));
  };

  // Filter groups and subitems by user role
  const userRole = user?.role || "customer";
  const filteredGroups = sidebarGroups.filter(group => {
    const groupRoleMatch = group.roles.includes(userRole as UserRole);

    if (group.type === "link") {
      return groupRoleMatch;
    }

    if (group.type === "group" && group.subItems) {
      const allowedSubItems = group.subItems.filter(sub => sub.roles.includes(userRole as UserRole));
      return groupRoleMatch && allowedSubItems.length > 0;
    }

    return false;
  });

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-card">
      <div className="h-16 px-4 border-b flex items-center shrink-0">
        <NavLink to="/admin" className="flex items-center gap-3" onClick={() => setOpen(false)}>
          <div className="p-2 bg-primary/10 rounded-lg shrink-0">
            {company?.logo_url ? (
              <img src={company.logo_url} alt="Logo" className="h-6 w-6 object-contain" />
            ) : (
              <Shield className="h-6 w-6 text-primary" />
            )}
          </div>
          <div className="truncate">
            <h1 className="font-bold truncate text-sm uppercase">{company?.company_name || 'GARAGE'}</h1>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Admin Panel</p>
          </div>
        </NavLink>
      </div>

      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {filteredGroups.map((group) => {
          if (group.type === "link") {
            const Icon = group.icon || Shield;
            const isActive = group.end
              ? location.pathname === group.path
              : location.pathname.startsWith(group.path);

            return (
              <NavLink
                key={group.path}
                to={group.path}
                end={group.end}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors relative ${isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
              >
                <Icon className="h-5 w-5" />
                <span className="flex-1">{group.label}</span>
              </NavLink>
            );
          }

          // It's a group
          const GroupIcon = group.icon || Shield;
          const isOpen = expandedGroups[group.label];
          const allowedSubItems = group.subItems.filter(sub =>
            sub.roles.includes(userRole as UserRole)
          );

          const hasActiveChild = allowedSubItems.some(sub => isSubItemActive(sub));

          return (
            <div key={group.label} className="space-y-1">
              <button
                onClick={() => toggleGroup(group.label)}
                className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-muted ${hasActiveChild
                  ? "text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                <div className="flex items-center gap-3">
                  <GroupIcon className="h-5 w-5" />
                  <span>{group.label}</span>
                </div>
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground/70" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground/70" />
                )}
              </button>

              {isOpen && (
                <div className="pl-4 ml-3 border-l border-muted-foreground/20 space-y-1 py-1">
                  {allowedSubItems.map((sub) => {
                    const SubIcon = sub.icon || Shield;
                    const isActive = isSubItemActive(sub);

                    return (
                      <NavLink
                        key={sub.path}
                        to={sub.path}
                        end={sub.end}
                        onClick={() => setOpen(false)}
                        className={`flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors relative ${isActive
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                          }`}
                      >
                        <SubIcon className="h-4 w-4" />
                        <span className="flex-1 text-[13px]">{sub.label}</span>
                        {sub.label === "Inbox" && totalPending > 0 && (
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                            {totalPending}
                          </span>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

    </div>
  );

  return (
    <>
      {/* Dynamic style override to shift content down in desktop view to accommodate fixed topbar */}
      <style>{`
        @media (min-width: 1024px) {
          aside ~ .flex-1, aside ~ main {
            padding-top: 4.5rem !important;
          }
        }
      `}</style>

      {/* Mobile Header */}
      <div className="lg:hidden flex items-center justify-between p-4 border-b bg-card w-full sticky top-0 z-40 shadow-sm">
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
          <SheetContent side="left" className="p-0 w-[280px] sm:w-[320px] flex flex-col h-full bg-card">
            <div className="flex-1 overflow-y-auto">
              <SidebarContent />
            </div>
            <div className="p-4 border-t mt-auto">
              <div
                className="flex items-center gap-3 mb-3 cursor-pointer hover:bg-muted/50 p-2 rounded-lg transition-colors"
                onClick={() => {
                  setOpen(false);
                  setProfileOpen(true);
                }}
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
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Sidebar - Fixed Width */}
      <aside className="hidden lg:flex w-64 min-h-screen border-r flex-col fixed top-0 h-screen overflow-y-auto bg-card z-30">
        <SidebarContent />
      </aside>
      {/* Spacer for fixed sidebar */}
      <div className="hidden lg:block w-64 shrink-0 transition-all duration-300" />

      {/* Desktop Topbar */}
      <header className="hidden lg:flex fixed top-0 right-0 left-64 h-16 border-b bg-card/85 backdrop-blur-md items-center justify-between px-8 z-20 shadow-sm transition-all duration-300">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground/80">
            {company?.company_name || 'Garage'}
          </span>
        </div>
        
        <div className="flex items-center gap-6">
          <div 
            className="flex items-center gap-3 cursor-pointer hover:bg-muted/60 p-1.5 px-3 rounded-xl transition-all duration-200 border border-transparent hover:border-border"
            onClick={() => setProfileOpen(true)}
          >
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold shadow-inner">
              <User className="h-5 w-5" />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-sm font-bold leading-tight text-foreground">
                {user?.full_name || "User"}
              </span>
              <span className="text-[11px] text-muted-foreground font-medium leading-none mt-0.5">
                {user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'User'}
              </span>
            </div>
          </div>

          <Button
            onClick={signOut}
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full h-9 w-9 transition-colors"
            title="Logout"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Profile Dialog */}
      <UserProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </>
  );
}
