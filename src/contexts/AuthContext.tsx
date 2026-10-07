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

  const currentUserRef = useRef<AuthUser | null>(null);

  const updateUserState = (newUser: AuthUser | null) => {
    currentUserRef.current = newUser;
    setUser(newUser);
  };

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
    const authUser = currentSession?.user ? ({ ...currentSession.user } as AuthUser) : null;
    
    if (!authUser) {
      updateUserState(null);
      setLoading(false);
      return;
    }

    // PREVENT TAB-SWITCH RELOAD / DATA LOSS:
    // If user is already authenticated and has the same user ID (e.g. tab switch, window focus,
    // TOKEN_REFRESHED, or storage sync), NEVER toggle loading to true!
    // Setting loading = true unmounts ProtectedRoute and wipes all user-entered form data.
    if (currentUserRef.current && currentUserRef.current.id === authUser.id) {
      const existingRole = currentUserRef.current.role;
      const existingFullName = currentUserRef.current.full_name;
      const updatedUser: AuthUser = {
        ...authUser,
        role: existingRole,
        full_name: existingFullName,
      };
      updateUserState(updatedUser);
      setLoading(false);
      return;
    }

    // Only set loading = true during initial cold boot when no user is known yet
    if (!currentUserRef.current) {
      setLoading(true);
    }
    
    // Fetch role and profile data for newly signed in user
    const { role, full_name } = await fetchUserRoleData(authUser.id);
    
    if (!isMounted.current) return;

    const fullUser: AuthUser = {
      ...authUser,
      role,
      full_name,
    };
    updateUserState(fullUser);
    setLoading(false);
  };

  useEffect(() => {
    isMounted.current = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        handleAuthStateChange(event, currentSession);
      }
    );

    // Initial session check
    if (!initRef.current) {
      supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
        if (isMounted.current && !initRef.current) {
          initRef.current = true;
          if (initialSession) {
            handleAuthStateChange("INITIAL_SESSION", initialSession);
          } else {
            setLoading(false);
          }
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
    updateUserState(null);
    setSession(null);
    setLoading(false);
    navigate("/auth");
  };

  const refreshUser = async () => {
    const currentId = currentUserRef.current?.id || session?.user?.id;
    if (currentId) {
      const { role, full_name } = await fetchUserRoleData(currentId);
      if (isMounted.current && currentUserRef.current) {
        const updated = { ...currentUserRef.current, role, full_name };
        updateUserState(updated);
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
