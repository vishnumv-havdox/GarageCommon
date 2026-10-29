import { supabase } from "@/integrations/supabase/client";
import { broadcastDataUpdate } from "@/utils/realtimeSync";

export interface BillingTaxSettings {
  enable_dual_gst: boolean;
  single_gst_rate: number;
  service_gst_rate: number;
  spare_gst_rate: number;
  service_gst_number?: string;
  spare_gst_number?: string;
}

export const DEFAULT_BILLING_SETTINGS: BillingTaxSettings = {
  enable_dual_gst: false,
  single_gst_rate: 18,
  service_gst_rate: 18,
  spare_gst_rate: 28,
  service_gst_number: "",
  spare_gst_number: "",
};

const STORAGE_KEY = "driveflow_billing_settings";

/**
 * Synchronously retrieves billing settings with localStorage and profile fallback
 */
export function getBillingSettings(profile?: any): BillingTaxSettings {
  // 1. Try from passed-in profile
  const fromProfile =
    profile?.billing_settings ||
    profile?.bank_details?.billing_settings;

  if (fromProfile && typeof fromProfile.enable_dual_gst === "boolean") {
    return {
      enable_dual_gst: Boolean(fromProfile.enable_dual_gst),
      single_gst_rate: Number(fromProfile.single_gst_rate ?? DEFAULT_BILLING_SETTINGS.single_gst_rate),
      service_gst_rate: Number(fromProfile.service_gst_rate ?? DEFAULT_BILLING_SETTINGS.service_gst_rate),
      spare_gst_rate: Number(fromProfile.spare_gst_rate ?? DEFAULT_BILLING_SETTINGS.spare_gst_rate),
      service_gst_number: (typeof fromProfile.service_gst_number === "string" && fromProfile.service_gst_number.trim())
        ? fromProfile.service_gst_number.trim()
        : (profile?.tax_id || ""),
      spare_gst_number: (typeof fromProfile.spare_gst_number === "string" && fromProfile.spare_gst_number.trim())
        ? fromProfile.spare_gst_number.trim()
        : (profile?.tax_id || ""),
    };
  }

  // 2. Try from localStorage
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (typeof parsed.enable_dual_gst === "boolean") {
          return {
            enable_dual_gst: Boolean(parsed.enable_dual_gst),
            single_gst_rate: Number(parsed.single_gst_rate ?? DEFAULT_BILLING_SETTINGS.single_gst_rate),
            service_gst_rate: Number(parsed.service_gst_rate ?? DEFAULT_BILLING_SETTINGS.service_gst_rate),
            spare_gst_rate: Number(parsed.spare_gst_rate ?? DEFAULT_BILLING_SETTINGS.spare_gst_rate),
            service_gst_number: typeof parsed.service_gst_number === "string" && parsed.service_gst_number.trim()
              ? parsed.service_gst_number.trim()
              : (profile?.tax_id || ""),
            spare_gst_number: typeof parsed.spare_gst_number === "string" && parsed.spare_gst_number.trim()
              ? parsed.spare_gst_number.trim()
              : (profile?.tax_id || ""),
          };
        }
      }
    } catch (e) {
      console.warn("Failed to read billing settings from localStorage", e);
    }
  }

  return { 
    ...DEFAULT_BILLING_SETTINGS,
    service_gst_number: profile?.tax_id || "",
    spare_gst_number: profile?.tax_id || ""
  };
}

/**
 * Helper to get the applicable GSTIN for a bill or section (service vs part)
 */
export function getCompanyGstNumber(
  type: 'service' | 'part' | 'general',
  billingSettings?: BillingTaxSettings,
  defaultGst?: string
): string {
  if (billingSettings?.enable_dual_gst) {
    if (type === 'service' && billingSettings.service_gst_number?.trim()) {
      return billingSettings.service_gst_number.trim();
    }
    if (type === 'part' && billingSettings.spare_gst_number?.trim()) {
      return billingSettings.spare_gst_number.trim();
    }
  }
  return defaultGst || billingSettings?.service_gst_number || "";
}

/**
 * Save billing settings to localStorage and database
 */
export async function saveBillingSettings(
  settings: BillingTaxSettings,
  profileId?: string
): Promise<void> {
  // 1. Save to localStorage immediately
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.warn("Failed to save billing settings to localStorage", e);
    }
  }

  // 2. Persist to company_profiles
  try {
    let targetId = profileId;
    let existingProfile: any = null;

    if (!targetId) {
      const { data } = await supabase
        .from("company_profiles")
        .select("id, bank_details, tax_id")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      existingProfile = data;
      targetId = data?.id;
    } else {
      const { data } = await supabase
        .from("company_profiles")
        .select("id, bank_details, tax_id")
        .eq("id", targetId)
        .maybeSingle();
      existingProfile = data;
    }

    if (targetId) {
      const updatedBankDetails = {
        ...(existingProfile?.bank_details || {}),
        billing_settings: settings,
      };

      const updateData: any = {
        bank_details: updatedBankDetails,
      };
      if (settings.service_gst_number) {
        updateData.tax_id = settings.service_gst_number;
      }

      const { error: updateError } = await supabase
        .from("company_profiles")
        .update(updateData)
        .eq("id", targetId);

      if (updateError) {
        console.error("Failed to update company_profiles with billing settings:", updateError);
      }
    }

    // Broadcast realtime update across all tabs and open windows
    broadcastDataUpdate('all');
    broadcastDataUpdate('company_profile');
  } catch (error) {
    console.error("Error persisting billing settings:", error);
  }
}

/**
 * Returns the effective GST rate for an item based on its type and current settings
 */
export function getItemGstRate(
  itemType: "service" | "part" | string,
  settings: BillingTaxSettings,
  customRate?: number
): number {
  if (customRate !== undefined && customRate !== null && !isNaN(customRate)) {
    return Number(customRate);
  }

  if (settings.enable_dual_gst) {
    return itemType === "part"
      ? Number(settings.spare_gst_rate)
      : Number(settings.service_gst_rate);
  }

  return Number(settings.single_gst_rate);
}

/**
 * Helper to calculate GST components
 */
export function calculateTaxSplit(taxableValue: number, gstRate: number) {
  const taxable = Number(taxableValue) || 0;
  const rate = Number(gstRate) || 0;
  const halfRate = rate / 2;
  const cgstAmount = Number((taxable * (halfRate / 100)).toFixed(2));
  const sgstAmount = Number((taxable * (halfRate / 100)).toFixed(2));
  const totalTax = cgstAmount + sgstAmount;
  const total = taxable + totalTax;

  return {
    taxable,
    gstRate: rate,
    cgstRate: halfRate,
    sgstRate: halfRate,
    cgstAmount,
    sgstAmount,
    totalTax,
    total,
  };
}
