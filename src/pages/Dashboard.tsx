import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";

export default function Dashboard() {
  const { user, loading } = useAuth();

  if (loading) {
    return null;
  }

  // Redirect based on role
  if (user?.role === "admin") {
    return <Navigate to="/admin" replace />;
  } else if (user?.role === "staff") {
    return <Navigate to="/staff" replace />;
  } else if (user?.role === "customer") {
    return <Navigate to="/customer" replace />;
  }

  return <Navigate to="/auth" replace />;
}