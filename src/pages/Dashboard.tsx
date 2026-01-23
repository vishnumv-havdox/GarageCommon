import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { getRedirectPath } from "@/config/accessControl";

export default function Dashboard() {
  const { user, loading } = useAuth();

  if (loading) {
    return null;
  }

  // Use centralized access control for redirect
  const redirectPath = getRedirectPath("/dashboard", user?.role);
  
  if (redirectPath && redirectPath !== "/dashboard") {
    return <Navigate to={redirectPath} replace />;
  }

  return <Navigate to="/auth" replace />;
}

