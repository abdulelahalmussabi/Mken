import { getTenantDb } from "@/lib/mken/tenant";

/**
 * Incoming product orders in `mken_orders`, keyed by `tenant_slug` and shared
 * with the legacy admin panel. Tailoring activities carry an extra production
 * pipeline between `confirmed` and `completed`.
 */

export const BASE_ORDER_STATUSES = ["pending", "confirmed", "cancelled", "completed"] as const;

export const TAILORING_STATUSES = [
  "measurements_pending",
  "cutting",
  "stitching",
  "ironing_packaging",
  "ready",
] as const;

export const ORDER_STATUSES = [...BASE_ORDER_STATUSES, ...TAILORING_STATUSES] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_PAYMENT_STATUSES = ["unpaid", "paid", "failed", "refunded"] as const;
export type OrderPaymentStatus = (typeof ORDER_PAYMENT_STATUSES)[number];

export const TAILORING_ACTIVITIES = ["tailoring", "military-tailoring"];

export interface OrderItem {
  icon?: string;
  serviceTitle?: string;
  quantity?: number;
  priceLabel?: string;
}

export interface Order {
  id: string;
  tenantSlug: string;
  activityId: string | null;
  activityTitle: string;
  items: OrderItem[];
  customerName: string;
  phone: string;
  district: string;
  locationAddress: string;
  notes: string;
  status: OrderStatus;
  createdAt: string | null;
  paymentStatus: OrderPaymentStatus;
  paymentMethod: string | null;
  paymentAmount: number | null;
}

interface OrderRow {
  id: string;
  tenant_slug?: string | null;
  activity_id?: string | null;
  activity_title?: string | null;
  items?: OrderItem[] | string | null;
  customer_name?: string | null;
  phone?: string | null;
  district?: string | null;
  location_address?: string | null;
  notes?: string | null;
  status?: string | null;
  created_at?: string | null;
  payment_status?: string | null;
  payment_method?: string | null;
  payment_amount?: number | string | null;
}

function parseItems(items: OrderRow["items"]): OrderItem[] {
  if (!items) return [];
  if (typeof items === "string") {
    try {
      return JSON.parse(items);
    } catch {
      return [];
    }
  }
  return items;
}

function toOrder(row: OrderRow): Order {
  return {
    id: row.id,
    tenantSlug: row.tenant_slug || "default",
    activityId: row.activity_id || null,
    activityTitle: row.activity_title || "",
    items: parseItems(row.items),
    customerName: row.customer_name || "",
    phone: row.phone || "",
    district: row.district || "",
    locationAddress: row.location_address || "",
    notes: row.notes || "",
    status: (ORDER_STATUSES as readonly string[]).includes(row.status || "")
      ? (row.status as OrderStatus)
      : "pending",
    createdAt: row.created_at || null,
    paymentStatus: (ORDER_PAYMENT_STATUSES as readonly string[]).includes(row.payment_status || "")
      ? (row.payment_status as OrderPaymentStatus)
      : "unpaid",
    paymentMethod: row.payment_method || null,
    paymentAmount: row.payment_amount != null ? Number(row.payment_amount) : null,
  };
}

export async function fetchOrders(
  tenantSlug: string
): Promise<{ orders?: Order[]; error?: string }> {
  const db = getTenantDb();
  if (!db) return { error: "قاعدة البيانات غير مهيأة على الخادم" };

  const { data, error } = await db
    .from("mken_orders")
    .select("*")
    .eq("tenant_slug", tenantSlug)
    .order("created_at", { ascending: false });

  if (error) return { error: error.message };
  return { orders: (data as OrderRow[]).map(toOrder) };
}

export async function updateOrder(
  tenantSlug: string,
  id: string,
  updates: { status?: OrderStatus; paymentStatus?: OrderPaymentStatus; notes?: string }
): Promise<{ order?: Order; error?: string; notFound?: boolean }> {
  const db = getTenantDb();
  if (!db) return { error: "قاعدة البيانات غير مهيأة على الخادم" };

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.status) patch.status = updates.status;
  if (updates.paymentStatus) patch.payment_status = updates.paymentStatus;
  if (updates.notes !== undefined) patch.notes = updates.notes;

  const { data, error } = await db
    .from("mken_orders")
    .update(patch)
    .eq("id", id)
    .eq("tenant_slug", tenantSlug)
    .select("*");

  if (error) return { error: error.message };
  if (!data?.length) return { error: "الطلب غير موجود", notFound: true };
  return { order: toOrder(data[0] as OrderRow) };
}
