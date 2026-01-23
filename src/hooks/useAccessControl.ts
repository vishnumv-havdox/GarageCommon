/**
 * Access Control Hook
 * 
 * Provides utilities for checking user permissions based on the centralized
 * access control configuration.
 * 
 * Usage:
 * - useAccessControl() - Get access control utilities
 * - useHasAccess(path) - Check if current user can access a path
 * - useRedirectUnauthorized(path) - Redirect if user can't access path
 */

import { useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth, UserRole } from "@/hooks/useAuth";
import {
  accessControlConfig,
  getAccessRule,
  hasAccess as checkAccess,
  getRedirectPath,
  getAccessibleRoutes,
  type AccessRule,
} from "@/config/accessControl";

/**
 * Hook to check if current user has access to a specific path
 */
export function useHasAccess(path: string): boolean {
  const { user } = useAuth();
  return checkAccess(path, user?.role);
}

/**
 * Hook that redirects to appropriate page if user doesn't have access
 */
export function useRedirectUnauthorized(path: string): void {
  const navigate = useNavigate();
  const { user } = useAuth();
  const redirectPath = getRedirectPath(path, user?.role);

  if (redirectPath && redirectPath !== path) {
    navigate(redirectPath, { replace: true });
  }
}

/**
 * Main access control hook - provides all utilities
 */
export function useAccessControl() {
  const { user } = useAuth();
  const location = useLocation();

  const currentPath = location.pathname;
  const accessRule = getAccessRule(currentPath);
  const canAccess = user ? checkAccess(currentPath, user.role) : false;

  return useMemo(() => ({
    // Current user info
    userRole: user?.role as UserRole | undefined,
    isAuthenticated: !!user,
    
    // Current path info
    currentPath,
    accessRule,
    canAccess,
    
    // Helper functions
    hasAccess: (path: string) => checkAccess(path, user?.role),
    getRedirectPath: (path: string) => getRedirectPath(path, user?.role),
    getAccessibleRoutes: () => getAccessibleRoutes(user?.role as UserRole || "customer"),
    
    // Navigation helpers
    getNavItems: () => {
      const { navConfig } = require("@/config/accessControl");
      return navConfig.filter(
        (item: any) => item.roles.length === 0 || 
          (user && item.roles.includes(user.role as UserRole))
      );
    },
    
    // Check permission for specific action
    canView: (path: string) => checkAccess(path, user?.role),
    canEdit: (path: string) => {
      // Admins can edit everything
      if (user?.role === "admin") return true;
      // Staff can edit some admin routes
      const staffEditable = ["/admin/customers", "/admin/vehicles", "/admin/work-orders"];
      return staffEditable.some(p => path.startsWith(p)) && user?.role === "staff";
    },
    canDelete: (path: string) => {
      // Only admins can delete
      return user?.role === "admin";
    },
    canCreate: (path: string) => {
      // Admins can create everything
      if (user?.role === "admin") return true;
      // Staff can create some resources
      const staffCreatable = ["/admin/customers", "/admin/vehicles", "/admin/work-orders"];
      return staffCreatable.some(p => path.startsWith(p)) && user?.role === "staff";
    },
  }), [user, currentPath, accessRule, canAccess]);
}

/**
 * HOC wrapper for component-level access control
 * 
 * Usage:
 * const ProtectedComponent = withAccessControl(MyComponent, {
 *   allowedRoles: ["admin"],
 *   redirectTo: "/dashboard"
 * });
 */
export function withAccessControl<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options: {
    allowedRoles?: UserRole[];
    fallback?: React.ReactNode;
    redirectTo?: string;
  }
) {
  return function WithAccessControlComponent(props: P) {
    const { user } = useAuth();
    const navigate = useNavigate();
    
    const hasAccess = !options.allowedRoles || 
      (user && options.allowedRoles.includes(user.role as UserRole));
    
    if (!hasAccess && options.redirectTo) {
      navigate(options.redirectTo, { replace: true });
      return null;
    }
    
    if (!hasAccess && options.fallback) {
      return <>{options.fallback}</>;
    }
    
    if (!hasAccess) {
      return null;
    }
    
    return <WrappedComponent {...props} />;
  };
}

/**
 * Component for conditional rendering based on access
 * 
 * Usage:
 * <AccessControl allowedRoles={["admin"]}>
 *   <AdminPanel />
 * </AccessControl>
 */
interface AccessControlProps {
  allowedRoles: UserRole[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function AccessControl({ allowedRoles, children, fallback = null }: AccessControlProps) {
  const { user } = useAuth();
  
  if (!user || !allowedRoles.includes(user.role as UserRole)) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
}

export type { AccessRule };
