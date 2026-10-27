import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { initTheme } from "@/utils/themeManager";

export interface CompanyProfile {
  id?: string;
  company_name?: string;
  logo_url?: string;
  phone?: string;
  email?: string;
  address?: string;
  website?: string;
  gst_number?: string;
  bank_details?: any;
  theme_settings?: any;
  payment_qr_code_url?: string;
  created_at?: string;
  updated_at?: string;
}

const CACHE_KEY = ["garage_profile"];
const STORAGE_KEY = "driveflow_garage_profile";

// Synchronous local storage reader to prevent UI layout shift or empty flashes
const getStoredProfile = (): CompanyProfile | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed) {
      const theme = parsed.theme_settings || parsed.bank_details?.theme_settings;
      if (theme) initTheme(theme);
    }
    return parsed;
  } catch {
    return null;
  }
};

const storeProfile = (profile: CompanyProfile | null) => {
  if (typeof window === "undefined") return;
  try {
    if (profile) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch (e) {
    console.warn("Could not save garage profile to localStorage:", e);
  }
};

/**
 * useCompanyProfile
 * 
 * Fetches the garage profile ONCE and caches it indefinitely across navigation,
 * page transitions, and component re-renders. Refreshes only when explicitly invalidated.
 */
export function useCompanyProfile() {
  const queryClient = useQueryClient();

  const { data: profile, isLoading, refetch } = useQuery<CompanyProfile | null>({
    queryKey: CACHE_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_profiles")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        console.warn("Error fetching garage profile:", error);
      }

      if (data) {
        storeProfile(data);
        const theme = (data as any)?.theme_settings || (data as any)?.bank_details?.theme_settings;
        if (theme) {
          initTheme(theme);
        }
      }
      return data || null;
    },
    // Initial data from localStorage ensures instantaneous render
    initialData: () => getStoredProfile(),
    // Cache permanently across navigation and route changes
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24, // 24 hours
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: CACHE_KEY });
  };

  const updateProfileCache = (newProfile: Partial<CompanyProfile>) => {
    const updated = { ...(profile || {}), ...newProfile };
    storeProfile(updated);
    queryClient.setQueryData(CACHE_KEY, updated);
  };

  const companyName = profile?.company_name?.trim() || "Amma Auto Garage";
  const logoUrl = profile?.logo_url || null;

  return {
    profile,
    companyName,
    logoUrl,
    isLoading,
    refetch,
    invalidate,
    updateProfileCache,
  };
}

export default useCompanyProfile;
