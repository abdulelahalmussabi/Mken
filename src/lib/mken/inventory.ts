import { createClient } from "@/lib/supabase/client";

export interface InventoryItem {
  id: string;
  tenant_slug: string;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  cost_price: number;
  sell_price: number;
  quantity: number;
  min_stock_alert: number;
  image_url?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface InventoryTransaction {
  id: string;
  tenant_slug: string;
  item_id: string;
  type: "stock-in" | "stock-out" | "adjustment";
  quantity: number;
  reference_id?: string | null;
  notes?: string | null;
  created_at?: string;
}

export interface GetInventoryResult {
  items: InventoryItem[];
  tableMissing: boolean;
  error: string | null;
}

export interface GetTransactionsResult {
  transactions: InventoryTransaction[];
  tableMissing: boolean;
  error: string | null;
}

/**
 * Fetch inventory items for a specific tenant scope
 */
export async function getInventoryItems(tenantSlug: string): Promise<GetInventoryResult> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("mken_inventory_items")
      .select("*")
      .eq("tenant_slug", tenantSlug)
      .order("created_at", { ascending: false });

    if (error) {
      if (error.code === "PGRST205" || error.message?.includes("does not exist")) {
        return { items: [], tableMissing: true, error: null };
      }
      return { items: [], tableMissing: false, error: error.message };
    }

    const items: InventoryItem[] = (data || []).map((row) => ({
      id: row.id,
      tenant_slug: row.tenant_slug,
      name: row.name,
      sku: row.sku || null,
      barcode: row.barcode || null,
      cost_price: Number(row.cost_price || 0),
      sell_price: Number(row.sell_price || 0),
      quantity: Number(row.quantity || 0),
      min_stock_alert: Number(row.min_stock_alert || 0),
      image_url: row.image_url || null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    return { items, tableMissing: false, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("PGRST205") || message.includes("does not exist")) {
      return { items: [], tableMissing: true, error: null };
    }
    return { items: [], tableMissing: false, error: message };
  }
}

/**
 * Fetch inventory transactions for a specific tenant scope
 */
export async function getInventoryTransactions(
  tenantSlug: string,
  limit = 50
): Promise<GetTransactionsResult> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("mken_inventory_transactions")
      .select("*")
      .eq("tenant_slug", tenantSlug)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      if (error.code === "PGRST205" || error.message?.includes("does not exist")) {
        return { transactions: [], tableMissing: true, error: null };
      }
      return { transactions: [], tableMissing: false, error: error.message };
    }

    const transactions: InventoryTransaction[] = (data || []).map((row) => ({
      id: row.id,
      tenant_slug: row.tenant_slug,
      item_id: row.item_id,
      type: row.type as InventoryTransaction["type"],
      quantity: Number(row.quantity || 0),
      reference_id: row.reference_id || null,
      notes: row.notes || null,
      created_at: row.created_at,
    }));

    return { transactions, tableMissing: false, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("PGRST205") || message.includes("does not exist")) {
      return { transactions: [], tableMissing: true, error: null };
    }
    return { transactions: [], tableMissing: false, error: message };
  }
}

/**
 * Create a new inventory item
 */
export async function createInventoryItem(
  tenantSlug: string,
  item: Omit<InventoryItem, "id" | "tenant_slug">
): Promise<{ success: boolean; item?: InventoryItem; error?: string }> {
  try {
    const supabase = createClient();
    const id = "itm_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);

    const payload = {
      id,
      tenant_slug: tenantSlug,
      name: item.name,
      sku: item.sku || null,
      barcode: item.barcode || null,
      cost_price: item.cost_price || 0,
      sell_price: item.sell_price || 0,
      quantity: item.quantity || 0,
      min_stock_alert: item.min_stock_alert || 0,
      image_url: item.image_url || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("mken_inventory_items")
      .insert(payload)
      .select("*");

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data || data.length === 0) {
      return {
        success: false,
        error: "فشلت الإضافة: لم يتم إرجاع بيانات من Supabase. قد يكون ذلك بسبب سياسات RLS.",
      };
    }

    const created = data[0];
    return {
      success: true,
      item: {
        id: created.id,
        tenant_slug: created.tenant_slug,
        name: created.name,
        sku: created.sku,
        barcode: created.barcode,
        cost_price: Number(created.cost_price),
        sell_price: Number(created.sell_price),
        quantity: Number(created.quantity),
        min_stock_alert: Number(created.min_stock_alert),
        image_url: created.image_url,
        created_at: created.created_at,
        updated_at: created.updated_at,
      },
    };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Error creating item" };
  }
}

/**
 * Update an existing inventory item
 */
export async function updateInventoryItem(
  tenantSlug: string,
  id: string,
  updates: Partial<Omit<InventoryItem, "id" | "tenant_slug">>
): Promise<{ success: boolean; item?: InventoryItem; error?: string }> {
  try {
    const supabase = createClient();
    const payload = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("mken_inventory_items")
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
        error: "فشل التحديث: لم يتم تعديل أي صف. تحقق من معرف المنتج أو سياسات RLS.",
      };
    }

    const updated = data[0];
    return {
      success: true,
      item: {
        id: updated.id,
        tenant_slug: updated.tenant_slug,
        name: updated.name,
        sku: updated.sku,
        barcode: updated.barcode,
        cost_price: Number(updated.cost_price),
        sell_price: Number(updated.sell_price),
        quantity: Number(updated.quantity),
        min_stock_alert: Number(updated.min_stock_alert),
        image_url: updated.image_url,
        created_at: updated.created_at,
        updated_at: updated.updated_at,
      },
    };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Error updating item" };
  }
}

/**
 * Delete an inventory item
 */
export async function deleteInventoryItem(
  tenantSlug: string,
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("mken_inventory_items")
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
        error: "فشل الحذف: لم يتم حذف أي صف. قد يكون بسبب RLS أو المعرف غير صحيح.",
      };
    }

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Error deleting item" };
  }
}

/**
 * Record a stock movement transaction (in, out, or adjustment)
 */
export async function recordInventoryTransaction(
  tenantSlug: string,
  tx: Omit<InventoryTransaction, "id" | "tenant_slug">
): Promise<{ success: boolean; transaction?: InventoryTransaction; error?: string }> {
  try {
    const supabase = createClient();
    
    // 1. Get current item stock
    const { data: itemData, error: itemError } = await supabase
      .from("mken_inventory_items")
      .select("quantity")
      .eq("id", tx.item_id)
      .eq("tenant_slug", tenantSlug)
      .single();

    if (itemError || !itemData) {
      return { success: false, error: "المنتج غير موجود أو لا تملك صلاحية الوصول إليه." };
    }

    const currentQty = Number(itemData.quantity || 0);
    let newQty = currentQty;

    if (tx.type === "stock-in") {
      newQty = currentQty + tx.quantity;
    } else if (tx.type === "stock-out") {
      newQty = Math.max(0, currentQty - tx.quantity);
    } else if (tx.type === "adjustment") {
      newQty = tx.quantity;
    }

    // 2. Insert transaction log
    const { data: txData, error: txInsertErr } = await supabase
      .from("mken_inventory_transactions")
      .insert({
        tenant_slug: tenantSlug,
        item_id: tx.item_id,
        type: tx.type,
        quantity: tx.quantity,
        reference_id: tx.reference_id || null,
        notes: tx.notes || null,
        created_at: new Date().toISOString(),
      })
      .select("*");

    if (txInsertErr) {
      return { success: false, error: txInsertErr.message };
    }

    // 3. Update product quantity
    await supabase
      .from("mken_inventory_items")
      .update({ quantity: newQty, updated_at: new Date().toISOString() })
      .eq("id", tx.item_id)
      .eq("tenant_slug", tenantSlug);

    const createdTx = txData && txData[0];
    return {
      success: true,
      transaction: createdTx
        ? {
            id: createdTx.id,
            tenant_slug: createdTx.tenant_slug,
            item_id: createdTx.item_id,
            type: createdTx.type,
            quantity: Number(createdTx.quantity),
            reference_id: createdTx.reference_id,
            notes: createdTx.notes,
            created_at: createdTx.created_at,
          }
        : undefined,
    };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Error recording transaction" };
  }
}
