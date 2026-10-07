import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VehiclePlateBadge } from "@/components/shared/VehiclePlateBadge";
import {
  Truck,
  Car,
  User,
  Building2,
  Calendar,
  Gauge,
  Wrench,
  AlertTriangle,
  Eye,
  Edit2,
  Trash2,
  ShieldCheck,
  Plus,
} from "lucide-react";
import { format, isPast, differenceInDays } from "date-fns";

interface ModernVehicleCardProps {
  vehicle: any;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export const ModernVehicleCard: React.FC<ModernVehicleCardProps> = ({
  vehicle,
  onView,
  onEdit,
  onDelete,
}) => {
  const navigate = useNavigate();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const images: string[] =
    vehicle.photos && vehicle.photos.length > 0
      ? vehicle.photos
      : vehicle.photo_url
      ? [vehicle.photo_url]
      : [];

  const hasMultipleImages = images.length > 1;

  useEffect(() => {
    if (!hasMultipleImages) return;
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % images.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [hasMultipleImages, images.length]);

  // Status badge styling
  const statusLower = (vehicle.status || "active").toLowerCase();
  const isAvailable = statusLower === "active" || statusLower === "available";
  const isInService = statusLower.includes("service") || statusLower.includes("repair");

  // FC Expiry calculation
  const getFcStatus = () => {
    if (!vehicle.fc_expiry_date) return null;
    const expiry = new Date(vehicle.fc_expiry_date);
    const past = isPast(expiry);
    const daysLeft = differenceInDays(expiry, new Date());

    if (past) {
      return { label: "FC Expired", variant: "destructive" as const, alert: true };
    }
    if (daysLeft <= 30) {
      return { label: `FC Due (${daysLeft}d)`, variant: "warning" as const, alert: true };
    }
    return { label: `FC Valid (${format(expiry, "MMM yy")})`, variant: "outline" as const, alert: false };
  };

  const fcInfo = getFcStatus();

  return (
    <div className="group rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col overflow-hidden">
      {/* 16:9 Aspect Ratio Hero Photo */}
      <div className="relative h-44 bg-slate-100 dark:bg-slate-800/60 overflow-hidden border-b border-slate-100 dark:border-slate-800">
        {images.length > 0 ? (
          <img
            src={images[currentImageIndex]}
            alt={vehicle.vehicle_number}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-800">
            <Truck className="h-10 w-10 opacity-40 mb-1" />
            <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-400">
              No Photo Uploaded
            </span>
          </div>
        )}

        {/* Top Badges Overlay */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-2">
          {/* Status pill */}
          <Badge
            variant="outline"
            className={`text-[10px] font-bold uppercase backdrop-blur-md shadow-sm border ${
              isInService
                ? "bg-blue-900/80 text-white border-blue-400/30"
                : isAvailable
                ? "bg-emerald-900/80 text-white border-emerald-400/30"
                : "bg-slate-900/80 text-white border-slate-700"
            }`}
          >
            {vehicle.status || "Active"}
          </Badge>

          {/* Photo Count */}
          {hasMultipleImages && (
            <Badge
              variant="secondary"
              className="bg-black/60 backdrop-blur-md text-white text-[10px] font-semibold border border-white/20"
            >
              {currentImageIndex + 1}/{images.length}
            </Badge>
          )}
        </div>

        {/* Image carousel dots */}
        {hasMultipleImages && (
          <div className="absolute bottom-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-sm p-1 rounded-full">
            {images.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentImageIndex(idx);
                }}
                className={`h-1.5 rounded-full transition-all ${
                  currentImageIndex === idx ? "w-4 bg-white" : "w-1.5 bg-white/50"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Card Content */}
      <div className="p-4 sm:p-5 flex flex-col flex-1 space-y-3">
        {/* Registration Plate & Model */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <VehiclePlateBadge plateNumber={vehicle.vehicle_number} size="lg" />
            {fcInfo && (
              <Badge
                variant={fcInfo.variant === "destructive" ? "destructive" : "outline"}
                className={`text-[10px] font-semibold ${
                  fcInfo.variant === "warning"
                    ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40"
                    : ""
                }`}
              >
                {fcInfo.label}
              </Badge>
            )}
          </div>

          <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">
            {vehicle.vehicle_models?.vehicle_manufacturers?.name || ""}{" "}
            {vehicle.vehicle_models?.name || "Standard Model"}
            {vehicle.year ? ` (${vehicle.year})` : ""}
          </h3>

          <p className="text-[11px] text-slate-500 font-medium">
            {vehicle.vehicle_models?.vehicle_types?.name || "Vehicle"} •{" "}
            {vehicle.vehicle_models?.vehicle_types?.vehicle_categories?.name || "Fleet"}
          </p>
        </div>

        {/* Owner / Customer Information */}
        {vehicle.customer && (
          <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 pt-1 border-t border-slate-100 dark:border-slate-800/80">
            <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span className="text-slate-400 font-medium">Owner:</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
              {vehicle.customer.name}
            </span>
          </div>
        )}

        {/* Health & Mileage Matrix (2x2 grid) */}
        <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-xs">
          <div>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
              Odometer
            </span>
            <span className="font-bold text-slate-800 dark:text-slate-200">
              {vehicle.kilometers_driven ? `${vehicle.kilometers_driven.toLocaleString()} km` : "N/A"}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
              Next Service
            </span>
            <span className="font-bold text-slate-800 dark:text-slate-200">
              {vehicle.next_service_km
                ? `${vehicle.next_service_km.toLocaleString()} km`
                : vehicle.next_service_date
                ? format(new Date(vehicle.next_service_date), "MMM d, yyyy")
                : "Up to date"}
            </span>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="mt-auto pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 h-8 text-xs font-semibold text-slate-700 dark:text-slate-200"
            onClick={() => navigate(`/admin/vehicles/${vehicle.id}`)}
          >
            <Eye className="h-3.5 w-3.5 mr-1 text-slate-400" /> Dossier
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="h-8 px-2.5 text-xs text-blue-600 border-blue-200 hover:bg-blue-50 dark:border-blue-900 dark:hover:bg-blue-950/40 font-semibold"
            onClick={() => navigate(`/admin/work-orders?create=true&vehicleId=${vehicle.id}&customerId=${vehicle.customer_id || vehicle.customer?.id || ''}`)}
            title="1-Click Create Work Order"
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Job Card
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-slate-500 hover:text-slate-700"
            onClick={onEdit}
            title="Edit Vehicle"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
            onClick={onDelete}
            title="Delete Vehicle"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
};
