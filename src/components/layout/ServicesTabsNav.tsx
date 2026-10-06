import React from "react";
import { NavLink } from "react-router-dom";
import { Layers, BookOpen } from "lucide-react";

export function ServicesTabsNav() {
  const tabs = [
    { label: "Service Master & Labor", path: "/admin/services", icon: Layers },
    { label: "Customer Packages & Catalog", path: "/admin/booking-catalog", icon: BookOpen },
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
