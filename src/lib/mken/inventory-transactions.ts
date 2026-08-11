import { createClient } from "@/lib/supabase/client";

export interface InventoryTransaction {
  id: string;
  tenant_slug: string;
  item_id: string;
  item_name?: string | null;
  type: "stock-in" | "stock-out" | "adjustment";
  quantity: number;
  reference_id?: string | null;
  notes?: string | null;
  created_at?: string;
}

export interface GetTransactionsResult {
  transactions: InventoryTransaction[];
  tableMissing: boolean;
  error: string | null;
}

/**
 * Fetch inventory transactions for a specific tenant scope with optional filtering
 */
export async function getDetailedInventoryTransactions(
  tenantSlug: string,
  typeFilter?: string,
  itemIdFilter?: string,
  limit = 100
): Promise<GetTransactionsResult> {
  try {
    const supabase = createClient();

    let query = supabase
      .from("mken_inventory_transactions")
      .select("*")
      .eq("tenant_slug", tenantSlug)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (typeFilter && ["stock-in", "stock-out", "adjustment"].includes(typeFilter)) {
      query = query.eq("type", typeFilter);
    }

    if (itemIdFilter) {
      query = query.eq("item_id", itemIdFilter);
    }

    const { data, error } = await query;

    if (error) {
      if (error.code === "PGRST205" || error.message?.includes("does not exist")) {
        return { transactions: [], tableMissing: true, error: null };
      }
      return { transactions: [], tableMissing: false, error: error.message };
    }

    // Optionally fetch item names
    const itemIds = Array.from(new Set((data || []).map((row) => row.item_id).filter(Boolean)));
    let itemMap: Record<string, string> = {};

    if (itemIds.length > 0) {
      const { data: itemRows } = await supabase
        .from("mken_inventory_items")
        .select("id, name")
        .in("id", itemIds);

      if (itemRows) {
        itemRows.forEach((row) => {
          itemMap[row.id] = row.name;
        });
      }
    }

    const transactions: InventoryTransaction[] = (data || []).map((row) => ({
      id: row.id,
      tenant_slug: row.tenant_slug,
      item_id: row.item_id,
      item_name: itemMap[row.item_id] || null,
      type: row.type as InventoryTransaction["type"],
      quantity: Number(row.quantity || 0),
      reference_id: row.reference_id || null,
      notes: row.notes || null,
      created_at: row.created_at,
    }));

    return { transactions, tableMissing: false, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error fetching transactions";
    if (message.includes("PGRST205") || message.includes("does not exist")) {
      return { transactions: [], tableMissing: true, error: null };
    }
    return { transactions: [], tableMissing: false, error: message };
  }
}

/**
 * Record a new inventory transaction and update item stock
 */
export async function createDetailedTransaction(
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

    // 2. Insert transaction record
    const payload = {
      tenant_slug: tenantSlug,
      item_id: tx.item_id,
      type: tx.type,
      quantity: tx.quantity,
      reference_id: tx.reference_id || null,
      notes: tx.notes || null,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("mken_inventory_transactions")
      .insert(payload)
      .select("*");

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data || data.length === 0) {
      return { success: false, error: "فشلت كتابة الحركة المخزنية. قد يكون بسبب سياسات RLS." };
    }

    // 3. Update stock in inventory items
    await supabase
      .from("mken_inventory_items")
      .update({ quantity: newQty, updated_at: new Date().toISOString() })
      .eq("id", tx.item_id)
      .eq("tenant_slug", tenantSlug);

    const created = data[0];
    return {
      success: true,
      transaction: {
        id: created.id,
        tenant_slug: created.tenant_slug,
        item_id: created.item_id,
        type: created.type,
        quantity: Number(created.quantity),
        reference_id: created.reference_id,
        notes: created.notes,
        created_at: created.created_at,
      },
    };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Error creating transaction" };
  }
}
