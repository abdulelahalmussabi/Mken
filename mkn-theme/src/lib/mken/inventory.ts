import { getTenantDb } from "@/lib/mken/tenant";

/**
 * Warehouse items in `mken_inventory_items`. Admin reads the private table
 * (includes `cost_price`); the public site uses `mken_public_inventory_items`
 * which deliberately omits cost. Low-stock is quantity <= min_stock_alert.
 */

export interface InventoryItem {
  id: string;
  tenantSlug: string;
  name: string;
  sku: string;
  barcode: string;
  costPrice: number;
  sellPrice: number;
  quantity: number;
  minStockAlert: number;
  imageUrl: string;
  lowStock: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

interface InventoryRow {
  id: string;
  tenant_slug?: string | null;
  name?: string | null;
  sku?: string | null;
  barcode?: string | null;
  cost_price?: number | string | null;
  sell_price?: number | string | null;
  quantity?: number | string | null;
  min_stock_alert?: number | string | null;
  image_url?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

function toItem(row: InventoryRow): InventoryItem {
  const quantity = Number(row.quantity) || 0;
  const minStockAlert = Number(row.min_stock_alert) || 0;

  return {
    id: row.id,
    tenantSlug: row.tenant_slug || "default",
    name: row.name || "",
    sku: row.sku || "",
    barcode: row.barcode || "",
    costPrice: Number(row.cost_price) || 0,
    sellPrice: Number(row.sell_price) || 0,
    quantity,
    minStockAlert,
    imageUrl: row.image_url || "",
    lowStock: quantity <= minStockAlert,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

export interface InventoryTotals {
  count: number;
  lowStock: number;
  stockValueCost: number;
  stockValueSell: number;
}

export function summarize(items: InventoryItem[]): InventoryTotals {
  const round = (value: number) => Math.round(value * 100) / 100;
  return {
    count: items.length,
    lowStock: items.filter((i) => i.lowStock).length,
    stockValueCost: round(items.reduce((sum, i) => sum + i.costPrice * Math.max(0, i.quantity), 0)),
    stockValueSell: round(items.reduce((sum, i) => sum + i.sellPrice * Math.max(0, i.quantity), 0)),
  };
}

function isMissingTable(error: { code?: string; message?: string }): boolean {
  return error.code === "PGRST205" || /Could not find the table/i.test(error.message || "");
}

export async function fetchInventory(
  tenantSlug: string
): Promise<{ items?: InventoryItem[]; error?: string; tableMissing?: boolean }> {
  const db = getTenantDb();
  if (!db) return { error: "قاعدة البيانات غير مهيأة على الخادم" };

  const { data, error } = await db
    .from("mken_inventory_items")
    .select("*")
    .eq("tenant_slug", tenantSlug)
    .order("name", { ascending: true });

  if (error) {
    if (isMissingTable(error)) return { items: [], tableMissing: true };
    return { error: error.message };
  }

  return { items: (data as InventoryRow[]).map(toItem) };
}

export interface InventoryUpdate {
  name?: string;
  sku?: string;
  barcode?: string;
  costPrice?: number;
  sellPrice?: number;
  quantity?: number;
  minStockAlert?: number;
  imageUrl?: string;
}

export function validateInventory(update: InventoryUpdate, requireName = false): string | null {
  if (requireName && !update.name?.trim()) return "اسم الصنف مطلوب";
  if (update.name !== undefined && !update.name.trim()) return "اسم الصنف مطلوب";

  for (const [key, label] of [
    ["costPrice", "سعر التكلفة"],
    ["sellPrice", "سعر البيع"],
    ["quantity", "الكمية"],
    ["minStockAlert", "حد التنبيه"],
  ] as const) {
    const value = update[key];
    if (value === undefined) continue;
    if (!Number.isFinite(value) || value < 0) return `${label} يجب أن يكون رقمًا غير سالب`;
  }

  return null;
}

export async function createInventoryItem(
  tenantSlug: string,
  update: InventoryUpdate
): Promise<{ item?: InventoryItem; error?: string }> {
  const db = getTenantDb();
  if (!db) return { error: "قاعدة البيانات غير مهيأة على الخادم" };

  const id = `inv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const payload = {
    id,
    tenant_slug: tenantSlug,
    name: update.name?.trim(),
    sku: update.sku?.trim() || null,
    barcode: update.barcode?.trim() || null,
    cost_price: Number(update.costPrice) || 0,
    sell_price: Number(update.sellPrice) || 0,
    quantity: Number(update.quantity) || 0,
    min_stock_alert: Number(update.minStockAlert) || 0,
    image_url: update.imageUrl?.trim() || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await db.from("mken_inventory_items").insert(payload).select("*");

  if (error) {
    if (isMissingTable(error)) {
      return { error: "جدول المخزون غير مُنشأ في قاعدة البيانات" };
    }
    return { error: error.message };
  }
  if (!data?.length) return { error: "تعذّر إضافة الصنف: لا توجد صلاحية كتابة" };

  return { item: toItem(data[0] as InventoryRow) };
}

export async function updateInventoryItem(
  tenantSlug: string,
  id: string,
  update: InventoryUpdate
): Promise<{ item?: InventoryItem; error?: string; notFound?: boolean }> {
  const db = getTenantDb();
  if (!db) return { error: "قاعدة البيانات غير مهيأة على الخادم" };

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (update.name !== undefined) patch.name = update.name.trim();
  if (update.sku !== undefined) patch.sku = update.sku.trim() || null;
  if (update.barcode !== undefined) patch.barcode = update.barcode.trim() || null;
  if (update.costPrice !== undefined) patch.cost_price = update.costPrice;
  if (update.sellPrice !== undefined) patch.sell_price = update.sellPrice;
  if (update.quantity !== undefined) patch.quantity = update.quantity;
  if (update.minStockAlert !== undefined) patch.min_stock_alert = update.minStockAlert;
  if (update.imageUrl !== undefined) patch.image_url = update.imageUrl.trim() || null;

  const { data, error } = await db
    .from("mken_inventory_items")
    .update(patch)
    .eq("id", id)
    .eq("tenant_slug", tenantSlug)
    .select("*");

  if (error) {
    if (isMissingTable(error)) {
      return { error: "جدول المخزون غير مُنشأ في قاعدة البيانات", notFound: true };
    }
    return { error: error.message };
  }
  if (!data?.length) {
    return { error: "الصنف غير موجود أو لا توجد صلاحية تعديل", notFound: true };
  }

  return { item: toItem(data[0] as InventoryRow) };
}

export async function deleteInventoryItem(
  tenantSlug: string,
  id: string
): Promise<{ deleted?: boolean; error?: string; notFound?: boolean }> {
  const db = getTenantDb();
  if (!db) return { error: "قاعدة البيانات غير مهيأة على الخادم" };

  const { data, error } = await db
    .from("mken_inventory_items")
    .delete()
    .eq("id", id)
    .eq("tenant_slug", tenantSlug)
    .select("id");

  if (error) {
    if (isMissingTable(error)) {
      return { error: "جدول المخزون غير مُنشأ في قاعدة البيانات", notFound: true };
    }
    return { error: error.message };
  }
  if (!data?.length) return { error: "الصنف غير موجود أو لا توجد صلاحية حذف", notFound: true };
  return { deleted: true };
}

export function parseInventoryBody(body: Record<string, unknown>): InventoryUpdate | string {
  const update: InventoryUpdate = {};

  if (typeof body.name === "string") update.name = body.name;
  if (typeof body.sku === "string") update.sku = body.sku;
  if (typeof body.barcode === "string") update.barcode = body.barcode;
  if (typeof body.imageUrl === "string") update.imageUrl = body.imageUrl;

  for (const key of ["costPrice", "sellPrice", "quantity", "minStockAlert"] as const) {
    if (body[key] === undefined) continue;
    const value = Number(body[key]);
    if (!Number.isFinite(value)) return `قيمة ${key} غير صحيحة`;
    update[key] = value;
  }

  return update;
}
