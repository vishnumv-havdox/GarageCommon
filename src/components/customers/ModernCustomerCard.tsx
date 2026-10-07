import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VehiclePlateBadge } from "@/components/shared/VehiclePlateBadge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Building2,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Receipt,
  Car,
  ChevronDown,
  ChevronUp,
  MoreVertical,
  Plus,
  BookText,
  Star,
  MessageSquare,
  Edit2,
  Trash2,
  Users,
  Shield,
  ArrowRight,
  UserCheck,
} from "lucide-react";
import { format } from "date-fns";

interface ModernCustomerCardProps {
  customer: any;
  customerVehicles: any[];
  customerWorkOrders: any[];
  customerInvoices: any[];
  customerDrivers: any[];
  companyContacts: any[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddVehicle: () => void;
  onManageContacts: () => void;
  onManageDrivers: () => void;
  onViewInvoice?: (invoice: any) => void;
}

export const ModernCustomerCard: React.FC<ModernCustomerCardProps> = ({
  customer,
  customerVehicles,
  customerWorkOrders,
  customerInvoices,
  customerDrivers,
  companyContacts,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete,
  onAddVehicle,
  onManageContacts,
  onManageDrivers,
  onViewInvoice,
}) => {
  const navigate = useNavigate();

  // Generate clean initials avatar (e.g. "Infosys Fleet" -> "IF", "Suresh Kumar" -> "SK")
  const getInitials = (name: string) => {
    if (!name) return "CU";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const initials = getInitials(customer.company_name || customer.name);
  const isCorporate = !!customer.company_name;

  // Active in-service count
  const activeJobsCount = new Set(customerWorkOrders.map((wo) => wo.vehicle_id)).size;

  // Clean phone number for WhatsApp / Tel
  const cleanPhone = customer.phone ? customer.phone.replace(/\D/g, "") : "";

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
      {/* Top Main Card Body */}
      <div className="p-4 sm:p-5 space-y-4">
        {/* Identity & Badges Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3.5 min-w-0">
            {/* Initials Avatar */}
            <div
              className={`h-12 w-12 rounded-2xl flex items-center justify-center font-bold text-base text-white shrink-0 shadow-sm ${
                isCorporate
                  ? "bg-gradient-to-br from-blue-600 to-indigo-700"
                  : "bg-gradient-to-br from-emerald-600 to-teal-700"
              }`}
            >
              {initials}
            </div>

            {/* Name & Details */}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
                  {customer.name}
                </h3>

                <Badge
                  variant={isCorporate ? "default" : "secondary"}
                  className="text-[10px] font-semibold uppercase tracking-wider h-5"
                >
                  {isCorporate ? "Corporate Fleet" : "Individual"}
                </Badge>

                {activeJobsCount > 0 && (
                  <Badge className="bg-blue-600 text-white font-bold text-[10px] animate-pulse">
                    <Car className="h-3 w-3 mr-1" />
                    {activeJobsCount} in Service
                  </Badge>
                )}
              </div>

              {customer.company_name && (
                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mt-0.5 truncate flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  {customer.company_name}
                </p>
              )}
            </div>
          </div>

          {/* Quick Right Action Dropdown */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs font-semibold text-slate-700 dark:text-slate-200"
              onClick={() => navigate(`/admin/customers/${customer.id}/ledger`)}
            >
              <BookText className="h-3.5 w-3.5 mr-1 text-slate-400" />
              Ledger
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 text-xs">
                <DropdownMenuLabel>Customer Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onEdit}>
                  <Edit2 className="h-3.5 w-3.5 mr-2" /> Edit Customer
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onAddVehicle}>
                  <Plus className="h-3.5 w-3.5 mr-2" /> Add Vehicle
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onManageContacts}>
                  <Users className="h-3.5 w-3.5 mr-2" /> Manage Key Contacts
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onManageDrivers}>
                  <UserCheck className="h-3.5 w-3.5 mr-2" /> Manage Drivers
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete Customer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Micro-KPI Summary Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
              Registered Fleet
            </span>
            <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
              {customerVehicles.length} Vehicles
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
              Active In Workshop
            </span>
            <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
              {activeJobsCount} Active Jobs
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
              Invoices Billed
            </span>
            <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
              {customerInvoices.length} Invoices
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
              Account Since
            </span>
            <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
              {customer.created_at ? format(new Date(customer.created_at), "MMM yyyy") : "N/A"}
            </span>
          </div>
        </div>

        {/* Contact & Location Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs text-slate-600 dark:text-slate-300 pt-2 border-t border-slate-100 dark:border-slate-800">
          {/* Phone with instant Call & WhatsApp actions */}
          {customer.phone && (
            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50/70 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800/80">
              <span className="flex items-center gap-1.5 font-medium truncate">
                <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{customer.phone}</span>
              </span>
              <div className="flex items-center gap-1 shrink-0 ml-2">
                <a
                  href={`tel:${customer.phone}`}
                  className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
                  title="Call Customer"
                >
                  <Phone className="h-3.5 w-3.5" />
                </a>
                <a
                  href={`https://wa.me/91${cleanPhone}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 rounded hover:bg-emerald-100 dark:hover:bg-emerald-950/40 text-emerald-600"
                  title="WhatsApp Message"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          )}

          {/* Email */}
          {customer.email && (
            <div className="flex items-center p-2 rounded-xl bg-slate-50/70 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800/80 truncate">
              <Mail className="h-3.5 w-3.5 text-slate-400 mr-2 shrink-0" />
              <span className="truncate">{customer.email}</span>
            </div>
          )}

          {/* GSTIN */}
          {customer.gst_number && (
            <div className="flex items-center p-2 rounded-xl bg-slate-50/70 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800/80 font-mono text-xs">
              <Receipt className="h-3.5 w-3.5 text-slate-400 mr-2 shrink-0" />
              <span>GST: {customer.gst_number}</span>
            </div>
          )}

          {/* Address */}
          {customer.address && (
            <div className="sm:col-span-2 lg:col-span-3 flex items-start gap-1.5 text-xs text-slate-500 pt-1">
              <MapPin className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
              <span className="line-clamp-1">{customer.address}</span>
            </div>
          )}
        </div>

        {/* Designated Key Company Contacts (if any) */}
        {companyContacts && companyContacts.length > 0 && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
              Key Company Contacts ({companyContacts.length})
            </span>
            <div className="flex flex-wrap gap-1.5">
              {companyContacts.map((ct) => (
                <div
                  key={ct.id}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                >
                  {ct.is_primary && <Star className="h-3 w-3 text-amber-500 fill-amber-500 shrink-0" />}
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{ct.name}</span>
                  {ct.designation && (
                    <span className="text-[10px] text-slate-500 font-mono">({ct.designation})</span>
                  )}
                  <a
                    href={`tel:${ct.phone}`}
                    className="text-slate-400 hover:text-emerald-600 p-0.5 ml-1"
                    title={`Call ${ct.name}`}
                  >
                    <Phone className="h-3 w-3" />
                  </a>
                  <a
                    href={`https://wa.me/91${ct.phone.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-400 hover:text-emerald-600 p-0.5"
                    title={`WhatsApp ${ct.name}`}
                  >
                    <MessageSquare className="h-3 w-3" />
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Drawer Toggle & Fast Action Button */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 h-8 gap-1"
            onClick={onToggleExpand}
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4" /> Hide Fleet & Records
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" /> View Fleet ({customerVehicles.length}) & Invoices ({customerInvoices.length})
              </>
            )}
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs font-semibold text-blue-700 dark:text-blue-300 border-blue-200 hover:bg-blue-50 dark:border-blue-900"
            onClick={() => navigate(`/admin/work-orders?create=true&customerId=${customer.id}`)}
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> New Work Order
          </Button>
        </div>
      </div>

      {/* Expandable Fleet & Invoices Drawer */}
      {isExpanded && (
        <div className="p-4 sm:p-5 bg-slate-50/60 dark:bg-slate-950/40 border-t border-slate-200 dark:border-slate-800 space-y-4 animate-in slide-in-from-top-2 duration-200">
          {/* Registered Vehicles Mini Grid */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Car className="h-3.5 w-3.5 text-blue-600" /> Registered Vehicles ({customerVehicles.length})
              </span>
              <Button size="sm" variant="ghost" className="h-6 text-[11px] px-2 text-blue-600" onClick={onAddVehicle}>
                <Plus className="h-3 w-3 mr-1" /> Add Vehicle
              </Button>
            </div>

            {customerVehicles.length === 0 ? (
              <p className="text-xs text-slate-400 py-2">No vehicles registered for this customer yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {customerVehicles.map((v) => (
                  <div
                    key={v.id}
                    className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between"
                  >
                    <div>
                      <VehiclePlateBadge plateNumber={v.vehicle_number} size="sm" />
                      <p className="text-[11px] text-slate-500 font-medium mt-1 truncate">
                        {v.model || "Vehicle"} {v.year ? `(${v.year})` : ""}
                      </p>
                    </div>
                    <Link
                      to={`/admin/vehicles/${v.id}`}
                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
                      title="View Vehicle"
                    >
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Invoices Mini Grid */}
          <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Receipt className="h-3.5 w-3.5 text-emerald-600" /> Recent Invoices ({customerInvoices.length})
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-[11px] px-2 text-emerald-600"
                onClick={() => navigate(`/admin/invoices?customerId=${customer.id}`)}
              >
                View Invoices <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>

            {customerInvoices.length === 0 ? (
              <p className="text-xs text-slate-400 py-2">No invoices recorded yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {customerInvoices.slice(0, 3).map((inv) => (
                  <div
                    key={inv.id}
                    className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between"
                  >
                    <div>
                      <span className="font-mono font-bold text-xs text-slate-800 dark:text-slate-200">
                        {inv.invoice_number || `#INV-${inv.id.slice(0, 5)}`}
                      </span>
                      <p className="text-[11px] font-semibold text-emerald-600 mt-0.5">
                        ₹{inv.total_amount ? Number(inv.total_amount).toLocaleString("en-IN") : "0"}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-medium capitalize">
                      {inv.payment_status || "Pending"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
