import { useState, useEffect } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useLocation } from "react-router-dom";

// Add manager role to UserRole type
export type UserRole = "admin" | "manager" | "staff" | "customer";

export interface AuthUser extends User {
  role?: UserRole;
  full_name?: string;
  user_roles?: {
    role: UserRole;
  }[];
}

export function useAuthDebug() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [debugInfo, setDebugInfo] = useState<string>("");
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Log location change
    console.log("[AuthDebug] Location changed:", location.pathname);
    setDebugInfo(prev => prev + `\n[${new Date().toLocaleTimeString()}] Location: ${location.pathname}`);

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log("[AuthDebug] Auth state change:", event);
        setDebugInfo(prev => prev + `\n[${new Date().toLocaleTimeString()}] Auth event: ${event}`);
        setSession(session);
        const authUser = session?.user ? { ...session.user } as AuthUser : null;
        setUser(authUser);
        
        // Fetch user role after auth state changes
        if (session?.user) {
          console.log("[AuthDebug] User logged in, fetching role for:", session.user.id);
          setDebugInfo(prev => prev + `\n[${new Date().toLocaleTimeString()}] Fetching role for ${session.user.id}`);
          setTimeout(() => {
            fetchUserRole(session!.user.id);
          }, 0);
        } else {
          console.log("[AuthDebug] No session, setting loading to false");
          setLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("[AuthDebug] Existing session:", session ? "found" : "none");
      setDebugInfo(prev => prev + `\n[${new Date().toLocaleTimeString()}] Existing session: ${session ? "found" : "none"}`);
      setSession(session);
      const authUser = session?.user ? { ...session.user } as AuthUser : null;
      setUser(authUser);
      
      if (session?.user) {
        console.log("[AuthDebug] Session user ID:", session.user.id);
        setDebugInfo(prev => prev + `\n[${new Date().toLocaleTimeString()}] Session user: ${session.user.id}`);
        fetchUserRole(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => {
      console.log("[AuthDebug] Cleaning up subscription");
      subscription.unsubscribe();
    };
  }, [location.pathname]);

  const fetchUserRole = async (userId: string) => {
    try {
      console.log("[AuthDebug] Starting role fetch for:", userId);
      setDebugInfo(prev => prev + `\n[${new Date().toLocaleTimeString()}] === Starting role fetch ===`);

      // First try to get existing role with explicit type
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();

      console.log("[AuthDebug] Role query result:", { data: roleData, error: roleError });
      setDebugInfo(prev => prev + `\n[${new Date().toLocaleTimeString()}] Role query: ${roleError ? `Error: ${roleError.message}` : `Found: ${roleData?.role || 'none'}`}`);

      let userRole: UserRole = "customer"; // default role

      if (roleError) {
        console.log("[AuthDebug] Role query error:", roleError);
        if (roleError.code === 'PGRST116') {
          // No role found, create default customer role
          console.log("[AuthDebug] No role found, creating default customer role");
          setDebugInfo(prev => prev + `\n[${new Date().toLocaleTimeString()}] Creating default customer role...`);
          const { error: insertError } = await supabase
            .from("user_roles")
            .insert({ user_id: userId, role: "customer" });

          if (insertError) {
            console.error("[AuthDebug] Error creating default role:", insertError);
            setDebugInfo(prev => prev + `\n[${new Date().toLocaleTimeString()}] Insert error: ${insertError.message}`);
          } else {
            console.log("[AuthDebug] Default customer role created");
            setDebugInfo(prev => prev + `\n[${new Date().toLocaleTimeString()}] Default role created successfully`);
          }
        }
      } else if (roleData) {
        console.log("[AuthDebug] Found role:", roleData.role);
        setDebugInfo(prev => prev + `\n[${new Date().toLocaleTimeString()}] Using existing role: ${roleData.role}`);
        userRole = roleData.role as UserRole;
      }

      // Fetch profile for full name
      console.log("[AuthDebug] Fetching profile for:", userId);
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .maybeSingle();

      if (profileError) {
        console.error("[AuthDebug] Profile fetch error:", profileError);
        setDebugInfo(prev => prev + `\n[${new Date().toLocaleTimeString()}] Profile error: ${profileError.message}`);
      } else if (profileData) {
        console.log("[AuthDebug] Found profile:", profileData);
        setDebugInfo(prev => prev + `\n[${new Date().toLocaleTimeString()}] Profile found: ${profileData.full_name || '(no name)'}`);
      }

      setUser((prev) => {
        const updated = prev ? {
          ...prev,
          role: userRole,
          full_name: profileData?.full_name,
        } : null;
        console.log("[AuthDebug] Updated user:", updated);
        setDebugInfo(prev => prev + `\n[${new Date().toLocaleTimeString()}] User updated - Role: ${userRole}, Name: ${profileData?.full_name || '(none)'}`);
        return updated;
      });
    } catch (error) {
      console.error("[AuthDebug] Unexpected error:", error);
      setDebugInfo(prev => prev + `\n[${new Date().toLocaleTimeString()}] Unexpected error: ${String(error)}`);
    } finally {
      console.log("[AuthDebug] Setting loading to false");
      setLoading(false);
      setDebugInfo(prev => prev + `\n[${new Date().toLocaleTimeString()}] === Fetch complete ===\n`);
    }
  };

  const signOut = async () => {
    console.log("[AuthDebug] Signing out...");
    setDebugInfo(prev => prev + `\n[${new Date().toLocaleTimeString()}] Signing out...`);
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    navigate("/auth");
  };

  const clearDebug = () => {
    setDebugInfo("");
  };

  return {
    user,
    session,
    loading,
    signOut,
    debugInfo,
    clearDebug,
    userRole: user?.role as UserRole | undefined,
    fullName: user?.full_name,
  };
}

