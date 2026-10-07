import React from "react";

interface VehiclePlateBadgeProps {
  plateNumber: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const VehiclePlateBadge: React.FC<VehiclePlateBadgeProps> = ({
  plateNumber,
  size = "md",
  className = "",
}) => {
  if (!plateNumber) {
    return <span className="text-xs text-muted-foreground font-mono">N/A</span>;
  }

  // Normalize spacing for standard Indian plate layout if needed
  const formatted = plateNumber.toUpperCase().trim();

  const sizeClasses = {
    sm: "h-5 text-[10px] px-1.5 gap-1",
    md: "h-6 text-xs px-2 gap-1.5",
    lg: "h-7 text-sm px-2.5 gap-2",
  };

  const indClasses = {
    sm: "text-[7px]",
    md: "text-[8px]",
    lg: "text-[9px]",
  };

  return (
    <div
      className={`inline-flex items-center rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-[0_1px_2px_rgba(0,0,0,0.06)] overflow-hidden font-mono select-all ${sizeClasses[size]} ${className}`}
      title={`Vehicle Plate: ${formatted}`}
    >
      {/* Blue IND left strip */}
      <div className="flex flex-col items-center justify-center -ml-1 pl-1 pr-0.5 self-stretch bg-blue-700 text-white font-bold tracking-tighter">
        <span className={`leading-none font-sans font-black ${indClasses[size]}`}>IND</span>
      </div>

      {/* Main Registration Code */}
      <span className="font-black tracking-wider text-slate-900 dark:text-slate-100 whitespace-nowrap">
        {formatted}
      </span>
    </div>
  );
};
