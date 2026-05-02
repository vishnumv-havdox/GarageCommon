import { useAuthContext } from "@/contexts/AuthContext";
export type { UserRole, AuthUser } from "@/contexts/AuthContext";

export function useAuth() {
  const context = useAuthContext();
  
  return {
    user: context.user,
    session: context.session,
    loading: context.loading,
    signOut: context.signOut,
    refreshUser: context.refreshUser,
  };
}