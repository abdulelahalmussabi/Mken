import { createClient } from "@/lib/supabase/client";

export interface TenantSettings {
  // Facility & Tax
  facility_name?: string;
  facility_phone?: string;
  facility_email?: string;
  facility_address?: string;
  vat_number?: string; // ZATCA VAT ID
  cr_number?: string; // Commercial Registration

  // WhatsApp Automation
  whatsapp_enabled?: boolean;
  whatsapp_provider?: "ultramsg" | "waba" | "taqnyat" | "evolution";
  whatsapp_token?: string;
  whatsapp_instance_id?: string;
  whatsapp_phone?: string;
  whatsapp_auto_reminders?: boolean;

  // Moyasar Payment Gateway
  moyasar_enabled?: boolean;
  moyasar_publishable_key?: string;
  moyasar_secret_key?: string;
  moyasar_auto_receipts?: boolean;

  // Catch-all for extra config_data fields
  [key: string]: any;
}

export interface GetSettingsResult {
  settings: TenantSettings;
  tableMissing: boolean;
  error: string | null;
}

/**
 * Mask sensitive tokens for safe client display
 */
export function maskToken(token?: string): string {
  if (!token || token.length <= 8) return token ? "••••••••" : "";
  return `${token.slice(0, 4)}••••••••${token.slice(-4)}`;
}

/**
 * Fetch tenant settings from mken_saas_clients.config_data
 */
export async function getTenantSettings(tenantSlug: string): Promise<GetSettingsResult> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("mken_saas_clients")
      .select("config_data, name")
      .eq("tenant_slug", tenantSlug)
      .single();

    if (error) {
      if (error.code === "PGRST205" || error.message?.includes("does not exist")) {
        return { settings: {}, tableMissing: true, error: null };
      }
      // If client row not found, return empty fallback
      if (error.code === "PGRST116") {
        return { settings: { facility_name: tenantSlug }, tableMissing: false, error: null };
      }
      return { settings: {}, tableMissing: false, error: error.message };
    }

    const config = (data?.config_data as TenantSettings) || {};
    const settings: TenantSettings = {
      ...config,
      facility_name: config.facility_name || data?.name || tenantSlug,
      // Mask secret keys for safe GET responses
      whatsapp_token_masked: maskToken(config.whatsapp_token),
      moyasar_secret_key_masked: maskToken(config.moyasar_secret_key),
    };

    return { settings, tableMissing: false, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error fetching settings";
    if (message.includes("PGRST205") || message.includes("does not exist")) {
      return { settings: {}, tableMissing: true, error: null };
    }
    return { settings: {}, tableMissing: false, error: message };
  }
}

/**
 * Update tenant settings in mken_saas_clients.config_data
 */
export async function updateTenantSettings(
  tenantSlug: string,
  newSettings: Partial<TenantSettings>
): Promise<{ success: boolean; settings?: TenantSettings; error?: string }> {
  try {
    const supabase = createClient();

    // 1. Fetch current config_data
    const { data: currentData, error: fetchErr } = await supabase
      .from("mken_saas_clients")
      .select("config_data")
      .eq("tenant_slug", tenantSlug)
      .single();

    if (fetchErr && fetchErr.code !== "PGRST116") {
      return { success: false, error: fetchErr.message };
    }

    const existingConfig = (currentData?.config_data as Record<string, any>) || {};

    // Don't overwrite secret keys with masked values
    const cleanUpdates = { ...newSettings };
    delete cleanUpdates.whatsapp_token_masked;
    delete cleanUpdates.moyasar_secret_key_masked;

    if (cleanUpdates.whatsapp_token && cleanUpdates.whatsapp_token.includes("••••")) {
      delete cleanUpdates.whatsapp_token;
    }

    if (cleanUpdates.moyasar_secret_key && cleanUpdates.moyasar_secret_key.includes("••••")) {
      delete cleanUpdates.moyasar_secret_key;
    }

    const mergedConfig = {
      ...existingConfig,
      ...cleanUpdates,
      updated_at: new Date().toISOString(),
    };

    // 2. Update config_data
    const { data: updateData, error: updateErr } = await supabase
      .from("mken_saas_clients")
      .update({ config_data: mergedConfig })
      .eq("tenant_slug", tenantSlug)
      .select("config_data");

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    if (!updateData || updateData.length === 0) {
      return {
        success: false,
        error: "فشل تحديث الإعدادات: لم يتم تعديل أي صف. قد يكون بسبب سياسات RLS.",
      };
    }

    const updatedConfig = (updateData[0].config_data as TenantSettings) || {};
    return {
      success: true,
      settings: {
        ...updatedConfig,
        whatsapp_token_masked: maskToken(updatedConfig.whatsapp_token),
        moyasar_secret_key_masked: maskToken(updatedConfig.moyasar_secret_key),
      },
    };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Error updating settings" };
  }
}
