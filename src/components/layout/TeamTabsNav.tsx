import React from "react";
import { NavLink } from "react-router-dom";
import { UserCheck, Shield, Key } from "lucide-react";

export function TeamTabsNav() {
  const tabs = [
    { label: "Staff Directory", path: "/admin/employees", icon: UserCheck },
    { label: "User Accounts & Credentials", path: "/admin/users", icon: Shield },
    { label: "Access & Role Control", path: "/admin/access-control", icon: Key },
  ];

  return (
    <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-xl border border-border/50 max-w-full overflow-x-auto no-scrollbar mb-6">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <NavLink
            key={tab.path}
            to={tab.path}
            className={({ isActive }) =>
              `flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold shrink-0 whitespace-nowrap transition-all ${
                isActive
                  ? "bg-card text-foreground shadow-sm border border-border/40 font-bold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`
            }
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{tab.label}</span>
          </NavLink>
        );
      })}
    </div>
  );
}
