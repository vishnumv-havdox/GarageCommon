import { useState, useEffect } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

export type UserRole = "admin" | "manager" | "staff" | "customer";

export interface AuthUser extends User {
  role?: UserRole;
  full_name?: string;
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        const authUser = session?.user ? { ...session.user } as AuthUser : null;
        setUser(authUser);
        
        // Fetch user role after auth state changes
        if (session?.user) {
          setTimeout(() => {
            fetchUserRole(session.user.id);
          }, 0);
        } else {
          setLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      const authUser = session?.user ? { ...session.user } as AuthUser : null;
      setUser(authUser);
      
      if (session?.user) {
        fetchUserRole(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserRole = async (userId: string) => {
    try {
      // First try to get existing role
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .single();

      let userRole: UserRole = "customer"; // default role

      if (roleError && roleError.code === 'PGRST116') {
        // No role found, create default customer role
        const { error: insertError } = await supabase
          .from("user_roles")
          .insert({ user_id: userId, role: "customer" });

        if (insertError) {
          console.error("Error creating default role:", insertError);
        }
      } else if (roleData) {
        userRole = roleData.role as UserRole;
      } else if (roleError) {
        console.error("Error fetching user role:", roleError);
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .single();

      setUser((prev) => ({
        ...prev!,
        role: userRole,
        full_name: profileData?.full_name,
      }));
    } catch (error) {
      console.error("Error fetching user role:", error);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    navigate("/auth");
  };

  return {
    user,
    session,
    loading,
    signOut,
  };
}