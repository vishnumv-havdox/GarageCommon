import { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth, type UserRole } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRequests } from "@/contexts/RequestsContext";
import {
  Shield, LogOut, Menu,
  LayoutDashboard, Wrench, Calendar, Inbox,
  Receipt, BookText, ArrowLeftRight,
  Users, Truck, Layers,
  Package, QrCode,
  UserCheck, CalendarCheck, Settings,
  Briefcase, User
} from "lucide-react";
import { navConfig } from "@/config/accessControl";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { UserProfileDialog } from "@/components/profile/UserProfileDialog";
import { NotificationBell } from "@/components/layout/NotificationBell";

export { navConfig };

interface SidebarSection {
  title: string;
  roles: UserRole[];
  items: {
    label: string;
    path: string;
    icon: any;
    roles: UserRole[];
    badgeKey?: "activeWorkOrders" | "totalPending";
    badgeVariant?: "default" | "destructive" | "secondary";
    end?: boolean;
    isActiveMatch?: (pathname: string) => boolean;
  }[];
}

const adminSections: SidebarSection[] = [
  {
    title: "Operations",
    roles: ["admin", "manager"],
    items: [
      {
        label: "Dashboard",
        path: "/admin",
        icon: LayoutDashboard,
        roles: ["admin", "manager"],
        end: true,
      },
      {
        label: "Work Orders",
        path: "/admin/work-orders",
        icon: Wrench,
        roles: ["admin", "manager"],
        badgeKey: "activeWorkOrders",
        badgeVariant: "secondary",
        isActiveMatch: (p) => p.startsWith("/admin/work-orders") || p === "/admin/progress",
      },
      {
        label: "Appointments",
        path: "/admin/appointments",
        icon: Calendar,
        roles: ["admin", "manager"],
        isActiveMatch: (p) => p.startsWith("/admin/appointments"),
      },
      {
        label: "Inbox",
        path: "/admin/requests",
        icon: Inbox,
        roles: ["admin", "manager"],
        badgeKey: "totalPending",
        badgeVariant: "destructive",
        isActiveMatch: (p) => p.startsWith("/admin/requests"),
      },
    ],
  },
  {
    title: "Billing & Finance",
    roles: ["admin", "manager"],
    items: [
      {
        label: "Invoices & Quotes",
        path: "/admin/invoices",
        icon: Receipt,
        roles: ["admin", "manager"],
        isActiveMatch: (p) => p.startsWith("/admin/invoices"),
      },
      {
        label: "Customer Ledgers",
        path: "/admin/ledger",
        icon: BookText,
        roles: ["admin", "manager"],
        isActiveMatch: (p) => p === "/admin/ledger" || (p.startsWith("/admin/customers/") && p.endsWith("/ledger")),
      },
      {
        label: "Tally Prime",
        path: "/admin/tally",
        icon: ArrowLeftRight,
        roles: ["admin", "manager"],
        isActiveMatch: (p) => p.startsWith("/admin/tally"),
      },
    ],
  },
  {
    title: "Fleet & CRM",
    roles: ["admin", "manager"],
    items: [
      {
        label: "Customers",
        path: "/admin/customers",
        icon: Users,
        roles: ["admin", "manager"],
        isActiveMatch: (p) => p.startsWith("/admin/customers") && !p.endsWith("/ledger"),
      },
      {
        label: "Vehicles",
        path: "/admin/vehicles",
        icon: Truck,
        roles: ["admin", "manager"],
        isActiveMatch: (p) => p.startsWith("/admin/vehicles"),
      },
      {
        label: "Services & Rates",
        path: "/admin/services",
        icon: Layers,
        roles: ["admin", "manager"],
        isActiveMatch: (p) => p.startsWith("/admin/services") || p.startsWith("/admin/booking-catalog"),
      },
    ],
  },
  {
    title: "Inventory",
    roles: ["admin", "manager", "staff"],
    items: [
      {
        label: "Stock & Spares",
        path: "/admin/inventory",
        icon: Package,
        roles: ["admin", "manager"],
        isActiveMatch: (p) => p.startsWith("/admin/inventory"),
      },
      {
        label: "Parts Kiosk",
        path: "/inventory/room",
        icon: QrCode,
        roles: ["admin", "manager", "staff"],
        isActiveMatch: (p) => p.startsWith("/inventory/room"),
      },
    ],
  },
  {
    title: "Workforce & Admin",
    roles: ["admin", "manager"],
    items: [
      {
        label: "Staff & Roles",
        path: "/admin/employees",
        icon: UserCheck,
        roles: ["admin", "manager"],
        isActiveMatch: (p) => p.startsWith("/admin/employees") || p.startsWith("/admin/users") || p.startsWith("/admin/access-control"),
      },
      {
        label: "Attendance & Payroll",
        path: "/admin/attendance",
        icon: CalendarCheck,
        roles: ["admin", "manager"],
        isActiveMatch: (p) => p.startsWith("/admin/attendance") || p.startsWith("/admin/salary"),
      },
      {
        label: "Settings & Reports",
        path: "/admin/settings",
        icon: Settings,
        roles: ["admin", "manager"],
        isActiveMatch: (p) => p.startsWith("/admin/settings") || p.startsWith("/admin/analytics"),
      },
    ],
  },
  {
    title: "Staff Portal",
    roles: ["staff"],
    items: [
      {
        label: "My Floor Dashboard",
        path: "/staff",
        icon: Briefcase,
        roles: ["staff"],
        end: true,
      },
      {
        label: "Check-in & Hours",
        path: "/staff/attendance",
        icon: CalendarCheck,
        roles: ["staff"],
        end: true,
      },
    ],
  },
  {
    title: "Customer Portal",
    roles: ["customer"],
    items: [
      {
        label: "My Vehicle Portal",
        path: "/customer",
        icon: User,
        roles: ["customer"],
        end: true,
      },
    ],
  },
];

export function AdminSidebar() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [company, setCompany] = useState<any>(null);
  const { totalPending, activeWorkOrders } = useRequests();

  useEffect(() => {
    const fetchProfile = async () => {
      const { data } = await supabase
        .from("company_profiles")
        .select("company_name, logo_url")
        .limit(1)
        .maybeSingle();
      if (data) setCompany(data);
    };
    fetchProfile();
  }, []);

  const userRole = (user?.role || "customer") as UserRole;

  const filteredSections = adminSections
    .filter((sec) => sec.roles.includes(userRole))
    .map((sec) => ({
      ...sec,
      items: sec.items.filter((item) => item.roles.includes(userRole)),
    }))
    .filter((sec) => sec.items.length > 0);

  const getBadgeValue = (key?: "activeWorkOrders" | "totalPending") => {
    if (key === "activeWorkOrders") return activeWorkOrders;
    if (key === "totalPending") return totalPending;
    return 0;
  };

  const SidebarNavList = () => (
    <div className="flex flex-col h-full bg-card">
      {/* Brand Header */}
      <div className="h-16 px-5 border-b flex items-center shrink-0">
        <NavLink to="/admin" className="flex items-center gap-3 group" onClick={() => setOpen(false)}>
          <div className="p-2 bg-primary/10 text-primary rounded-xl shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
            {company?.logo_url ? (
              <img src={company.logo_url} alt="Logo" className="h-5 w-5 object-contain" />
            ) : (
              <Shield className="h-5 w-5" />
            )}
          </div>
          <div className="truncate">
            <h1 className="font-extrabold truncate text-sm tracking-tight uppercase text-foreground">
              {company?.company_name || "GARAGE"}
            </h1>
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
              Management Suite
            </p>
          </div>
        </NavLink>
      </div>

      {/* Nav Items Grouped into 5 Pillars */}
      <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto no-scrollbar">
        {filteredSections.map((section) => (
          <div key={section.title} className="space-y-1">
            <h2 className="px-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70 mb-1.5">
              {section.title}
            </h2>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = item.isActiveMatch
                  ? item.isActiveMatch(location.pathname)
                  : item.end
                  ? location.pathname === item.path
                  : location.pathname.startsWith(item.path);

                const badgeVal = getBadgeValue(item.badgeKey);

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.end}
                    onClick={() => setOpen(false)}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-[13px] font-medium transition-all group ${
                      isActive
                        ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon
                        className={`h-4 w-4 shrink-0 transition-colors ${
                          isActive
                            ? "text-primary-foreground"
                            : "text-muted-foreground group-hover:text-foreground"
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </div>

                    {item.badgeKey && badgeVal > 0 && (
                      <span
                        className={`ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none ${
                          isActive
                            ? "bg-white text-primary"
                            : item.badgeVariant === "destructive"
                            ? "bg-rose-500 text-white"
                            : "bg-muted text-muted-foreground border border-border"
                        }`}
                      >
                        {badgeVal}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User Footer Card (Mobile Drawer only - on desktop, profile & logout are in the topbar) */}
      <div className="lg:hidden p-3 border-t bg-muted/20 shrink-0">
        <div
          className="flex items-center justify-between p-2 rounded-xl hover:bg-muted/80 cursor-pointer transition-colors"
          onClick={() => {
            setOpen(false);
            setProfileOpen(true);
          }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
              <User className="h-4 w-4" />
            </div>
            <div className="truncate">
              <p className="text-xs font-bold truncate text-foreground leading-tight">
                {user?.full_name || user?.email || "User"}
              </p>
              <p className="text-[10px] text-muted-foreground capitalize leading-tight">
                {user?.role || "Operator"}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              signOut();
            }}
            title="Sign Out"
          >
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop main content padding clearance for fixed topbar */}
      <style>{`
        @media (min-width: 1024px) {
          aside ~ main,
          aside ~ .admin-content,
          aside ~ .flex-1,
          aside ~ [class*="flex-1"],
          aside ~ div:not([class*="w-64"]),
          main {
            padding-top: 5.75rem !important;
          }
        }
        @media (max-width: 1023px) {
          aside ~ main,
          aside ~ .admin-content,
          aside ~ .flex-1,
          aside ~ [class*="flex-1"],
          aside ~ div:not([class*="w-64"]),
          main {
            padding-bottom: 5.5rem !important;
          }
        }
      `}</style>

      {/* Mobile Top Header */}
      <div className="lg:hidden flex items-center justify-between p-3.5 border-b bg-card w-full sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-primary/10 text-primary rounded-lg">
            {company?.logo_url ? (
              <img src={company.logo_url} alt="Logo" className="h-5 w-5 object-contain" />
            ) : (
              <Shield className="h-5 w-5" />
            )}
          </div>
          <span className="font-bold truncate max-w-[150px] uppercase text-xs">
            {company?.company_name || "Admin Panel"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <NotificationBell />
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-xl text-primary bg-primary/10 hover:bg-primary/20"
            onClick={() => setProfileOpen(true)}
            title="Profile"
          >
            <User className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Mobile Drawer Sheet (Triggered exclusively by bottom dock Menu button) */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="p-0 w-[280px] sm:w-[320px] flex flex-col h-full bg-card no-scrollbar">
          <SidebarNavList />
        </SheetContent>
      </Sheet>

      {/* Desktop Sidebar - Fixed Width */}
      <aside className="hidden lg:flex w-64 min-h-screen border-r flex-col fixed top-0 h-screen overflow-y-auto no-scrollbar bg-card z-30 shadow-[1px_0_0_0_rgba(0,0,0,0.04)]">
        <SidebarNavList />
      </aside>

      {/* Spacer for fixed sidebar */}
      <div className="hidden lg:block w-64 shrink-0" />

      {/* Desktop Topbar */}
      <header className="hidden lg:flex fixed top-0 right-0 left-64 h-16 border-b bg-card/90 backdrop-blur-md items-center justify-between px-8 z-20 transition-all duration-300">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">
            {company?.company_name || "Garage"}
          </span>
          <span className="text-muted-foreground/40">•</span>
          <span className="text-xs font-medium text-muted-foreground">
            Workshop Management
          </span>
        </div>

        <div className="flex items-center gap-4">
          <NotificationBell />

          <div
            className="flex items-center gap-3 cursor-pointer hover:bg-muted/70 p-1.5 px-3 rounded-xl transition-all border border-border/40 hover:border-border"
            onClick={() => setProfileOpen(true)}
          >
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold shadow-inner">
              <User className="h-4 w-4" />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-xs font-bold leading-tight text-foreground">
                {user?.full_name || "User"}
              </span>
              <span className="text-[10px] text-muted-foreground capitalize leading-none mt-0.5">
                {user?.role || "Operator"}
              </span>
            </div>
          </div>

          <Button
            onClick={signOut}
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl h-9 w-9 transition-colors"
            title="Sign Out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Mobile & Tablet Bottom Navigation Dock */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border/70 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] px-2 py-1.5 flex items-center justify-around safe-area-pb">
        {userRole === "admin" || userRole === "manager" ? (
          <>
            <NavLink
              to="/admin"
              end
              className={({ isActive }) =>
                `flex flex-col items-center justify-center min-w-[56px] py-1 px-1 rounded-xl transition-all ${
                  isActive
                    ? "text-primary font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`
              }
            >
              <LayoutDashboard className="h-5 w-5 mb-0.5" />
              <span className="text-[10px] tracking-tight">Home</span>
            </NavLink>

            <NavLink
              to="/admin/work-orders"
              className={({ isActive }) =>
                `flex flex-col items-center justify-center min-w-[56px] py-1 px-1 rounded-xl relative transition-all ${
                  isActive || location.pathname.startsWith("/admin/work-orders")
                    ? "text-primary font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`
              }
            >
              <div className="relative">
                <Wrench className="h-5 w-5 mb-0.5" />
                {activeWorkOrders > 0 && (
                  <span className="absolute -top-1 -right-2 px-1 min-w-[15px] h-[15px] rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center shadow-xs">
                    {activeWorkOrders}
                  </span>
                )}
              </div>
              <span className="text-[10px] tracking-tight">Jobs</span>
            </NavLink>

            <NavLink
              to="/admin/appointments"
              className={({ isActive }) =>
                `flex flex-col items-center justify-center min-w-[56px] py-1 px-1 rounded-xl transition-all ${
                  isActive || location.pathname.startsWith("/admin/appointments")
                    ? "text-primary font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`
              }
            >
              <Calendar className="h-5 w-5 mb-0.5" />
              <span className="text-[10px] tracking-tight">Bookings</span>
            </NavLink>

            <NavLink
              to="/admin/invoices"
              className={({ isActive }) =>
                `flex flex-col items-center justify-center min-w-[56px] py-1 px-1 rounded-xl transition-all ${
                  isActive || location.pathname.startsWith("/admin/invoices")
                    ? "text-primary font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`
              }
            >
              <Receipt className="h-5 w-5 mb-0.5" />
              <span className="text-[10px] tracking-tight">Invoices</span>
            </NavLink>

            <button
              type="button"
              onClick={() => setOpen(true)}
              className="flex flex-col items-center justify-center min-w-[56px] py-1 px-1 rounded-xl text-muted-foreground hover:text-foreground relative transition-all"
            >
              <div className="relative">
                <Menu className="h-5 w-5 mb-0.5" />
                {totalPending > 0 && (
                  <span className="absolute -top-1 -right-1.5 px-1 min-w-[15px] h-[15px] rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center shadow-xs">
                    {totalPending}
                  </span>
                )}
              </div>
              <span className="text-[10px] tracking-tight">Menu</span>
            </button>
          </>
        ) : (
          <>
            <NavLink
              to={userRole === "staff" ? "/staff" : "/customer"}
              end
              className={({ isActive }) =>
                `flex flex-col items-center justify-center min-w-[56px] py-1 px-1 rounded-xl transition-all ${
                  isActive ? "text-primary font-bold" : "text-muted-foreground"
                }`
              }
            >
              <LayoutDashboard className="h-5 w-5 mb-0.5" />
              <span className="text-[10px] tracking-tight">Portal</span>
            </NavLink>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="flex flex-col items-center justify-center min-w-[56px] py-1 px-1 rounded-xl text-muted-foreground hover:text-foreground transition-all"
            >
              <Menu className="h-5 w-5 mb-0.5" />
              <span className="text-[10px] tracking-tight">Menu</span>
            </button>
          </>
        )}
      </nav>

      {/* User Profile Dialog */}
      <UserProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </>
  );
}
