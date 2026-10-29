import React from "react";
import { Moon, Sun, Laptop } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useColorMode, ColorMode } from "@/utils/themeManager";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ThemeToggleProps {
  variant?: "ghost" | "outline" | "default";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  showDropdown?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  variant = "ghost",
  size = "icon",
  className = "",
  showDropdown = false,
}) => {
  const { mode, isDark, setMode, toggle } = useColorMode();

  if (showDropdown) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={variant}
            size={size}
            className={`relative rounded-xl transition-all duration-300 hover:bg-muted ${className}`}
            title="Appearance Mode"
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-amber-500" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 text-indigo-400" />
            <span className="sr-only">Toggle theme</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-36 rounded-xl border border-border shadow-lg">
          <DropdownMenuItem
            onClick={() => setMode("light")}
            className={`flex items-center gap-2 cursor-pointer font-medium ${
              mode === "light" ? "text-primary font-bold bg-primary/10" : ""
            }`}
          >
            <Sun className="h-4 w-4 text-amber-500" />
            <span>Light</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setMode("dark")}
            className={`flex items-center gap-2 cursor-pointer font-medium ${
              mode === "dark" ? "text-primary font-bold bg-primary/10" : ""
            }`}
          >
            <Moon className="h-4 w-4 text-indigo-400" />
            <span>Dark</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setMode("system")}
            className={`flex items-center gap-2 cursor-pointer font-medium ${
              mode === "system" ? "text-primary font-bold bg-primary/10" : ""
            }`}
          >
            <Laptop className="h-4 w-4 text-muted-foreground" />
            <span>System</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant={variant}
            size={size}
            onClick={toggle}
            className={`relative rounded-xl transition-colors duration-150 hover:bg-muted/80 text-foreground ${className}`}
            aria-label={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all duration-300 dark:-rotate-90 dark:scale-0 text-amber-500" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all duration-300 dark:rotate-0 dark:scale-100 text-indigo-400" />
            <span className="sr-only">{isDark ? "Light Mode" : "Dark Mode"}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs font-semibold">
          {isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
