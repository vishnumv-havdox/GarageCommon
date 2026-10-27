import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { getRedirectPath } from "@/config/accessControl";
import { HavDoxLoader } from "@/components/brand/HavDoxLoader";

export default function Dashboard() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <HavDoxLoader
        variant="fullscreen"
        message="Routing to active workspace..."
      />
    );
  }

  // Use centralized access control for redirect
  const redirectPath = getRedirectPath("/dashboard", user?.role);
  
  if (redirectPath && redirectPath !== "/dashboard") {
    return <Navigate to={redirectPath} replace />;
  }

  // If user is authenticated, send to /admin as primary workspace
  if (user) {
    return <Navigate to="/admin" replace />;
  }

  return <Navigate to="/auth" replace />;
}

