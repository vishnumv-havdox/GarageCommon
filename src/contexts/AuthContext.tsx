import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

export type UserRole = "admin" | "manager" | "staff" | "customer";

export interface AuthUser extends User {
  role?: UserRole;
  full_name?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const isMounted = useRef(true);
  const initRef = useRef(false);

  const fetchUserRoleData = async (userId: string): Promise<{ role: UserRole; full_name?: string }> => {
    try {
      console.log("[AuthContext] Fetching role for:", userId);
      // Fetch role
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();

      let userRole: UserRole = "customer"; // default role

      if (roleError) {
        console.error("[AuthContext] Error fetching user role:", roleError);
      } else if (roleData) {
        userRole = roleData.role as UserRole;
      } else {
        console.log("[AuthContext] No role found for user, defaulting to customer");
      }

      // Fetch profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .maybeSingle();

      return { role: userRole, full_name: profileData?.full_name };
    } catch (error) {
      console.error("[AuthContext] Unexpected error in fetchUserRoleData:", error);
      return { role: "customer" };
    }
  };

  const handleAuthStateChange = async (event: string, currentSession: Session | null) => {
    console.log("[AuthContext] Auth event:", event, currentSession?.user?.id);
    
    if (!isMounted.current) return;

    setSession(currentSession);
    const authUser = currentSession?.user ? { ...currentSession.user } as AuthUser : null;
    
    if (!authUser) {
      setUser(null);
      // Only set loading false if we finished the initial check, otherwise
      // let the fallback in initial check handle it to avoid flickering.
      if (initRef.current) {
        setLoading(false);
      }
      return;
    }

    // Only ensure we are in a loading state if we don't have a user yet
    if (!user) {
      setLoading(true);
    }
    
    // Fetch role and profile data
    const { role, full_name } = await fetchUserRoleData(authUser.id);
    
    if (!isMounted.current) return;

    // Set the complete user object and finish loading in one go or side-by-side
    // React 18 will batch these updates.
    setUser({
      ...authUser,
      role,
      full_name
    });
    setLoading(false);
  };

  useEffect(() => {
    isMounted.current = true;

    // Use onAuthStateChange as the primary source of truth.
    // It fires INITIAL_SESSION on setup in modern Supabase.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        handleAuthStateChange(event, currentSession);
      }
    );

    // Backup check in case INITIAL_SESSION doesn't fire or we need immediate session
    if (!initRef.current) {
      supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
        if (isMounted.current && !initRef.current) {
          if (initialSession) {
            handleAuthStateChange("INITIAL_SESSION", initialSession);
          } else {
            setLoading(false);
          }
          initRef.current = true;
        }
      });
    }

    return () => {
      isMounted.current = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    navigate("/auth");
  };

  const refreshUser = async () => {
    if (session?.user) {
      const { role, full_name } = await fetchUserRoleData(session.user.id);
      if (isMounted.current) {
        setUser(prev => prev ? { ...prev, role, full_name } : null);
      }
    }
  };

  const value = {
    user,
    session,
    loading,
    signOut,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return context;
};
