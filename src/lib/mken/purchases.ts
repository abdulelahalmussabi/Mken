import { createClient } from "@/lib/supabase/client";

export interface Vendor {
  id: string;
  tenant_slug: string;
  name: string;
  contact_person?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface PurchaseInvoiceItem {
  name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface PurchaseInvoice {
  id: string;
  tenant_slug: string;
  vendor_id?: string | null;
  vendor_name?: string | null;
  items: PurchaseInvoiceItem[];
  total_amount: number;
  payment_status: "paid" | "unpaid";
  created_at?: string;
  updated_at?: string;
}

export interface GetPurchasesResult {
  vendors: Vendor[];
  invoices: PurchaseInvoice[];
  tableMissing: boolean;
  error: string | null;
}

/**
 * Fetch vendors for tenant
 */
export async function getVendors(tenantSlug: string): Promise<{ vendors: Vendor[]; tableMissing: boolean; error: string | null }> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("mken_vendors")
      .select("*")
      .eq("tenant_slug", tenantSlug)
      .order("name", { ascending: true });

    if (error) {
      if (error.code === "PGRST205" || error.message?.includes("does not exist")) {
        return { vendors: [], tableMissing: true, error: null };
      }
      return { vendors: [], tableMissing: false, error: error.message };
    }

    const vendors: Vendor[] = (data || []).map((row) => ({
      id: row.id,
      tenant_slug: row.tenant_slug,
      name: row.name,
      contact_person: row.contact_person || null,
      phone: row.phone || null,
      email: row.email || null,
      address: row.address || null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    return { vendors, tableMissing: false, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error fetching vendors";
    if (message.includes("PGRST205") || message.includes("does not exist")) {
      return { vendors: [], tableMissing: true, error: null };
    }
    return { vendors: [], tableMissing: false, error: message };
  }
}

/**
 * Fetch purchase invoices for tenant
 */
export async function getPurchaseInvoices(tenantSlug: string): Promise<{ invoices: PurchaseInvoice[]; tableMissing: boolean; error: string | null }> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("mken_purchase_invoices")
      .select("*")
      .eq("tenant_slug", tenantSlug)
      .order("created_at", { ascending: false });

    if (error) {
      if (error.code === "PGRST205" || error.message?.includes("does not exist")) {
        return { invoices: [], tableMissing: true, error: null };
      }
      return { invoices: [], tableMissing: false, error: error.message };
    }

    const invoices: PurchaseInvoice[] = (data || []).map((row) => ({
      id: row.id,
      tenant_slug: row.tenant_slug,
      vendor_id: row.vendor_id || null,
      items: Array.isArray(row.items) ? row.items : [],
      total_amount: Number(row.total_amount || 0),
      payment_status: row.payment_status === "paid" ? "paid" : "unpaid",
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    return { invoices, tableMissing: false, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error fetching purchase invoices";
    if (message.includes("PGRST205") || message.includes("does not exist")) {
      return { invoices: [], tableMissing: true, error: null };
    }
    return { invoices: [], tableMissing: false, error: message };
  }
}

/**
 * Create a new vendor
 */
export async function createVendor(
  tenantSlug: string,
  vendorData: Omit<Vendor, "id" | "tenant_slug">
): Promise<{ success: boolean; vendor?: Vendor; error?: string }> {
  try {
    const supabase = createClient();
    const id = "vnd_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);

    const payload = {
      id,
      tenant_slug: tenantSlug,
      name: vendorData.name,
      contact_person: vendorData.contact_person || null,
      phone: vendorData.phone || null,
      email: vendorData.email || null,
      address: vendorData.address || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from("mken_vendors").insert(payload).select("*");

    if (error) return { success: false, error: error.message };
    if (!data || data.length === 0) {
      return { success: false, error: "فشلت الإضافة: لم يتم إرجاع صفوف. قد يكون بسبب سياسات RLS." };
    }

    const created = data[0];
    return {
      success: true,
      vendor: {
        id: created.id,
        tenant_slug: created.tenant_slug,
        name: created.name,
        contact_person: created.contact_person,
        phone: created.phone,
        email: created.email,
        address: created.address,
        created_at: created.created_at,
        updated_at: created.updated_at,
      },
    };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Error creating vendor" };
  }
}

/**
 * Update vendor
 */
export async function updateVendor(
  tenantSlug: string,
  id: string,
  updates: Partial<Omit<Vendor, "id" | "tenant_slug">>
): Promise<{ success: boolean; vendor?: Vendor; error?: string }> {
  try {
    const supabase = createClient();
    const payload = { ...updates, updated_at: new Date().toISOString() };

    const { data, error } = await supabase
      .from("mken_vendors")
      .update(payload)
      .eq("id", id)
      .eq("tenant_slug", tenantSlug)
      .select("*");

    if (error) return { success: false, error: error.message };
    if (!data || data.length === 0) {
      return { success: false, error: "فشل التحديث: لم يتم تعديل أي صف." };
    }

    const updated = data[0];
    return {
      success: true,
      vendor: {
        id: updated.id,
        tenant_slug: updated.tenant_slug,
        name: updated.name,
        contact_person: updated.contact_person,
        phone: updated.phone,
        email: updated.email,
        address: updated.address,
        created_at: updated.created_at,
        updated_at: updated.updated_at,
      },
    };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Error updating vendor" };
  }
}

/**
 * Delete vendor
 */
export async function deleteVendor(tenantSlug: string, id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("mken_vendors")
      .delete()
      .eq("id", id)
      .eq("tenant_slug", tenantSlug)
      .select("*");

    if (error) return { success: false, error: error.message };
    if (!data || data.length === 0) return { success: false, error: "فشل الحذف." };

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Error deleting vendor" };
  }
}

/**
 * Create a new purchase invoice
 */
export async function createPurchaseInvoice(
  tenantSlug: string,
  invoiceData: Omit<PurchaseInvoice, "id" | "tenant_slug">
): Promise<{ success: boolean; invoice?: PurchaseInvoice; error?: string }> {
  try {
    const supabase = createClient();
    const id = "pur_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);

    const payload = {
      id,
      tenant_slug: tenantSlug,
      vendor_id: invoiceData.vendor_id || null,
      items: invoiceData.items || [],
      total_amount: invoiceData.total_amount || 0,
      payment_status: invoiceData.payment_status || "unpaid",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from("mken_purchase_invoices").insert(payload).select("*");

    if (error) return { success: false, error: error.message };
    if (!data || data.length === 0) {
      return { success: false, error: "فشلت إضافة الفاتورة. قد يكون بسبب سياسات RLS." };
    }

    const created = data[0];
    return {
      success: true,
      invoice: {
        id: created.id,
        tenant_slug: created.tenant_slug,
        vendor_id: created.vendor_id,
        items: created.items || [],
        total_amount: Number(created.total_amount),
        payment_status: created.payment_status,
        created_at: created.created_at,
        updated_at: created.updated_at,
      },
    };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Error creating purchase invoice" };
  }
}

/**
 * Delete purchase invoice
 */
export async function deletePurchaseInvoice(
  tenantSlug: string,
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("mken_purchase_invoices")
      .delete()
      .eq("id", id)
      .eq("tenant_slug", tenantSlug)
      .select("*");

    if (error) return { success: false, error: error.message };
    if (!data || data.length === 0) return { success: false, error: "فشل حذف الفاتورة." };

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Error deleting invoice" };
  }
}
