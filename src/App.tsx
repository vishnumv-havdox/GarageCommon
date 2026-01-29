import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@/components/shared/ProtectedRoute";
import Login from "./pages/auth/Login";
import Dashboard from "./pages/Dashboard";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminEmployees from "./pages/admin/Employees";
import AdminCustomers from "./pages/admin/Customers";
import AdminVehicles from "./pages/admin/Vehicles";
import AdminWorkOrders from "./pages/admin/WorkOrders";
import AdminWorkOrderDetail from "./pages/admin/WorkOrderDetail";
import AdminAnalytics from "./pages/admin/Analytics";
import AdminProgress from "./pages/admin/Progress";
import AdminInventory from "./pages/admin/Inventory";
import AdminInvoices from "./pages/admin/Invoices";
import AdminInvoiceEditor from "./pages/admin/InvoiceEditor";
import InvoiceAnalytics from "./pages/admin/InvoiceAnalytics";
import AnalyticsDashboard from "./pages/admin/AnalyticsDashboard";
import AdminUsers from "./pages/admin/Users";
import AdminAccessControl from "./pages/admin/AccessControl";
import AdminSettings from "./pages/admin/Settings";
import InventoryLogin from "./pages/inventory/Login";
import InventoryRoom from "./pages/inventory/InventoryRoom";
import StaffDashboard from "./pages/staff/Dashboard";
import CustomerPortal from "./pages/customer/Portal";
import NotFound from "./pages/NotFound";
import { accessControlConfig } from "@/config/accessControl";

const queryClient = new QueryClient();

// Map route paths to components
const routeComponents: Record<string, React.ComponentType> = {
  "/dashboard": Dashboard,
  "/admin": AdminDashboard,
  "/admin/employees": AdminEmployees,
  "/admin/customers": AdminCustomers,
  "/admin/vehicles": AdminVehicles,
  "/admin/work-orders": AdminWorkOrders,
  "/admin/work-orders/:id": AdminWorkOrderDetail,
  "/admin/analytics": AdminAnalytics,
  "/admin/progress": AdminProgress,
  "/admin/inventory": AdminInventory,
  "/admin/invoices": AdminInvoices,
  "/admin/invoices/:id": AdminInvoiceEditor,
  "/admin/invoice-analytics": InvoiceAnalytics,
  "/admin/analytics-dashboard": AnalyticsDashboard,
  "/admin/users": AdminUsers,
  "/admin/access-control": AdminAccessControl,
  "/admin/settings": AdminSettings,
  "/inventory": AdminInventory,
  "/inventory/login": InventoryLogin,
  "/inventory/room": InventoryRoom,
  "/staff": StaffDashboard,
  "/customer": CustomerPortal,
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/auth" element={<Login />} />
          <Route path="/inventory/login" element={<InventoryLogin />} />

          {/* Generate routes from centralized access control config */}
          {accessControlConfig
            .filter(rule => rule.path !== "*" && rule.path !== "/inventory/login" && routeComponents[rule.path])
            .map(rule => (
              <Route
                key={rule.path}
                path={rule.path}
                element={
                  <ProtectedRoute allowedRoles={rule.allowedRoles}>
                    {React.createElement(routeComponents[rule.path])}
                  </ProtectedRoute>
                }
              />
            ))}

          {/* Catch-all route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

