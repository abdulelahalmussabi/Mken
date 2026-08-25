import { createClient } from "@/lib/supabase/client";

export interface Customer {
  id: string;
  tenant_slug: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  created_at?: string;
  updated_at?: string;
  outstanding_balance?: number; // Calculated debt if invoices exist
}

export interface GetCustomersResult {
  customers: Customer[];
  tableMissing: boolean;
  error: string | null;
}

/**
 * Fetch all customers for a given tenant scope
 */
export async function getCustomers(tenantSlug: string): Promise<GetCustomersResult> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("mken_customers")
      .select("*")
      .eq("tenant_slug", tenantSlug)
      .order("name", { ascending: true });

    if (error) {
      if (error.code === "PGRST205" || error.message?.includes("does not exist")) {
        return { customers: [], tableMissing: true, error: null };
      }
      return { customers: [], tableMissing: false, error: error.message };
    }

    const customers: Customer[] = (data || []).map((row) => ({
      id: row.id,
      tenant_slug: row.tenant_slug,
      name: row.name,
      phone: row.phone || null,
      email: row.email || null,
      address: row.address || null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    return { customers, tableMissing: false, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("PGRST205") || message.includes("does not exist")) {
      return { customers: [], tableMissing: true, error: null };
    }
    return { customers: [], tableMissing: false, error: message };
  }
}

/**
 * Create a new customer
 */
export async function createCustomer(
  tenantSlug: string,
  customerData: Omit<Customer, "id" | "tenant_slug">
): Promise<{ success: boolean; customer?: Customer; error?: string }> {
  try {
    const supabase = createClient();
    const id = "cst_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);

    const payload = {
      id,
      tenant_slug: tenantSlug,
      name: customerData.name,
      phone: customerData.phone || null,
      email: customerData.email || null,
      address: customerData.address || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("mken_customers")
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
      customer: {
        id: created.id,
        tenant_slug: created.tenant_slug,
        name: created.name,
        phone: created.phone,
        email: created.email,
        address: created.address,
        created_at: created.created_at,
        updated_at: created.updated_at,
      },
    };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Error creating customer" };
  }
}

/**
 * Update an existing customer
 */
export async function updateCustomer(
  tenantSlug: string,
  id: string,
  updates: Partial<Omit<Customer, "id" | "tenant_slug">>
): Promise<{ success: boolean; customer?: Customer; error?: string }> {
  try {
    const supabase = createClient();
    const payload = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("mken_customers")
      .update(payload)
      .eq("id", id)
      .eq("tenant_slug", tenantSlug)
      .select("*");

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data || data.length === 0) {
      return {
        success: false,
        error: "فشل التحديث: لم يتم تعديل أي صف. تحقق من المعرّف أو سياسات RLS.",
      };
    }

    const updated = data[0];
    return {
      success: true,
      customer: {
        id: updated.id,
        tenant_slug: updated.tenant_slug,
        name: updated.name,
        phone: updated.phone,
        email: updated.email,
        address: updated.address,
        created_at: updated.created_at,
        updated_at: updated.updated_at,
      },
    };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Error updating customer" };
  }
}

/**
 * Delete a customer
 */
export async function deleteCustomer(
  tenantSlug: string,
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("mken_customers")
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
        error: "فشل الحذف: لم يتم حذف أي صف. قد يكون بسبب RLS أو المعرّف غير صحيح.",
      };
    }

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Error deleting customer" };
  }
}
