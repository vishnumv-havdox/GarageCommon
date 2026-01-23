import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, LogOut } from "lucide-react";
import { navConfig } from "@/config/accessControl";

// Re-export for backward compatibility
export { navConfig };

export function AdminSidebar() {
  const { user, signOut } = useAuth();
  const location = useLocation();

  // Filter nav items based on user role
  // Show items where the user's role is included
  const filteredNav = navConfig.filter(
    item => item.roles.includes(user?.role || "customer")
  );

  return (
    <aside className="w-64 min-h-screen bg-card border-r flex flex-col">
      {/* Logo */}
      <div className="p-4 border-b">
        <NavLink to="/admin" className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="font-bold">AMMA AUTO</h1>
            <p className="text-xs text-muted-foreground">Admin Panel</p>
          </div>
        </NavLink>
      </div>

      {/* Navigation - Using centralized navConfig */}
      <nav className="flex-1 p-4 space-y-1">
        {filteredNav.map((item) => {
          const Icon = item.icon || Shield;
          const isActive = item.end
            ? location.pathname === item.path
            : location.pathname.startsWith(item.path);

          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      {/* User Info & Logout */}
      <div className="p-4 border-t">
        <div className="flex items-center gap-3 mb-3">
          <Badge variant="default">{user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'User'}</Badge>
          <span className="text-sm truncate">
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
    </aside>
  );
}

