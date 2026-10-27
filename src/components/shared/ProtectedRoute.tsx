import { Navigate, useLocation } from "react-router-dom";
import { useAuth, UserRole } from "@/hooks/useAuth";
import { HavDoxLoader } from "@/components/brand/HavDoxLoader";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Show official HavDox loader during initial auth resolution when user is not yet known
  if (loading && !user) {
    return (
      <HavDoxLoader
        variant="fullscreen"
        message="Loading workspace..."
      />
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // If roles are required, wait until the role is actually loaded
  if (allowedRoles && user.role === undefined) {
    return (
      <HavDoxLoader
        variant="fullscreen"
        message="Verifying access privileges..."
      />
    );
  }

  if (allowedRoles && user.role && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}