import { createClient } from "@/lib/supabase/client";
import crypto from "crypto";

export interface ApiKeyRecord {
  id: string;
  tenant_slug: string;
  key_name: string;
  api_key: string;
  masked_key?: string;
  created_at?: string;
  expires_at?: string | null;
}

export interface GetApiKeysResult {
  keys: ApiKeyRecord[];
  tableMissing: boolean;
  error: string | null;
}

/**
 * Mask an API key for safe display (e.g. "mkn_live_1234...9abc")
 */
export function maskKey(rawKey: string): string {
  if (!rawKey || rawKey.length <= 12) {
    return "••••••••••••••••";
  }
  const prefix = rawKey.slice(0, 9); // e.g. "mkn_live_"
  const suffix = rawKey.slice(-4);
  return `${prefix}••••••••${suffix}`;
}

/**
 * Generate a new secure API key
 */
export function generateApiKey(): string {
  const bytes = crypto.randomBytes(24).toString("hex");
  return `mkn_live_${bytes}`;
}

/**
 * Fetch API keys for a specific tenant scope
 */
export async function getApiKeys(tenantSlug: string): Promise<GetApiKeysResult> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("mken_api_keys")
      .select("*")
      .eq("tenant_slug", tenantSlug)
      .order("created_at", { ascending: false });

    if (error) {
      if (error.code === "PGRST205" || error.message?.includes("does not exist")) {
        return { keys: [], tableMissing: true, error: null };
      }
      return { keys: [], tableMissing: false, error: error.message };
    }

    const keys: ApiKeyRecord[] = (data || []).map((row) => ({
      id: row.id,
      tenant_slug: row.tenant_slug,
      key_name: row.key_name,
      api_key: row.api_key,
      masked_key: maskKey(row.api_key),
      created_at: row.created_at,
      expires_at: row.expires_at || null,
    }));

    return { keys, tableMissing: false, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("PGRST205") || message.includes("does not exist")) {
      return { keys: [], tableMissing: true, error: null };
    }
    return { keys: [], tableMissing: false, error: message };
  }
}

/**
 * Create a new API key
 */
export async function createApiKey(
  tenantSlug: string,
  keyName: string,
  expiresAt?: string | null
): Promise<{ success: boolean; keyRecord?: ApiKeyRecord; rawKey?: string; error?: string }> {
  try {
    const supabase = createClient();
    const rawKey = generateApiKey();

    const payload = {
      tenant_slug: tenantSlug,
      key_name: keyName.trim(),
      api_key: rawKey,
      created_at: new Date().toISOString(),
      expires_at: expiresAt || null,
    };

    const { data, error } = await supabase
      .from("mken_api_keys")
      .insert(payload)
      .select("*");

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data || data.length === 0) {
      return {
        success: false,
        error: "فشلت الإضافة: لم يتم إرجاع صفوف من Supabase. قد يكون بسبب سياسات RLS.",
      };
    }

    const created = data[0];
    return {
      success: true,
      rawKey,
      keyRecord: {
        id: created.id,
        tenant_slug: created.tenant_slug,
        key_name: created.key_name,
        api_key: created.api_key,
        masked_key: maskKey(created.api_key),
        created_at: created.created_at,
        expires_at: created.expires_at,
      },
    };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Error creating API key" };
  }
}

/**
 * Delete an API key by ID
 */
export async function deleteApiKey(
  tenantSlug: string,
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("mken_api_keys")
      .delete()
      .eq("id", id)
      .eq("tenant_slug", tenantSlug)
      .select("*");

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data || data.length === 0) {
      return {
        success: false,
        error: "فشل الحذف: لم يتم حذف أي مفتاح. تحقق من المعرف أو سياسات RLS.",
      };
    }

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Error deleting API key" };
  }
}
