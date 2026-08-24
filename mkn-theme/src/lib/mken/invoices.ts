import { getTenantDb } from "@/lib/mken/tenant";

/**
 * Customer invoices in `mken_invoices`. ZATCA fields are not columns: the
 * legacy code stores them as an extra entry inside the `items` JSON array
 * flagged with `isZatcaMeta`, so reads must split it out and writes must put it
 * back — otherwise the old admin panel loses the e-invoicing state.
 */

export const INVOICE_TYPES = ["invoice", "estimate"] as const;
export type InvoiceType = (typeof INVOICE_TYPES)[number];

export const INVOICE_PAYMENT_STATUSES = ["unpaid", "partial", "paid"] as const;
export type InvoicePaymentStatus = (typeof INVOICE_PAYMENT_STATUSES)[number];

export interface InvoiceItem {
  title?: string;
  serviceTitle?: string;
  quantity?: number;
  price?: number;
  total?: number;
}

interface ZatcaMeta {
  isZatcaMeta: true;
  zatcaStatus?: string | null;
  zatcaUuid?: string | null;
  zatcaXmlHash?: string | null;
  zatcaQrCode?: string | null;
}

export interface Invoice {
  id: string;
  tenantSlug: string;
  customerId: string | null;
  customerName: string;
  customerPhone: string;
  items: InvoiceItem[];
  subtotal: number;
  taxAmount: number;
  discount: number;
  totalAmount: number;
  paymentStatus: InvoicePaymentStatus;
  paymentMethod: string;
  type: InvoiceType;
  createdAt: string | null;
  updatedAt: string | null;
  zatcaStatus: string | null;
  zatcaUuid: string | null;
  zatcaQrCode: string | null;
}

interface InvoiceRow {
  id: string;
  tenant_slug?: string | null;
  customer_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  items?: (InvoiceItem | ZatcaMeta)[] | string | null;
  subtotal?: number | string | null;
  tax_amount?: number | string | null;
  discount?: number | string | null;
  total_amount?: number | string | null;
  payment_status?: string | null;
  payment_method?: string | null;
  type?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

function parseItems(raw: InvoiceRow["items"]): (InvoiceItem | ZatcaMeta)[] {
  if (!raw) return [];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return raw;
}

function isZatcaMeta(entry: InvoiceItem | ZatcaMeta): entry is ZatcaMeta {
  return (entry as ZatcaMeta)?.isZatcaMeta === true;
}

function toInvoice(row: InvoiceRow): Invoice {
  const all = parseItems(row.items);
  const meta = all.find(isZatcaMeta);
  const type = (INVOICE_TYPES as readonly string[]).includes(row.type || "")
    ? (row.type as InvoiceType)
    : "invoice";
  const paymentStatus = (INVOICE_PAYMENT_STATUSES as readonly string[]).includes(
    row.payment_status || ""
  )
    ? (row.payment_status as InvoicePaymentStatus)
    : "unpaid";

  return {
    id: row.id,
    tenantSlug: row.tenant_slug || "default",
    customerId: row.customer_id || null,
    customerName: row.customer_name || "",
    customerPhone: row.customer_phone || "",
    items: all.filter((entry): entry is InvoiceItem => !isZatcaMeta(entry)),
    subtotal: Number(row.subtotal) || 0,
    taxAmount: Number(row.tax_amount) || 0,
    discount: Number(row.discount) || 0,
    totalAmount: Number(row.total_amount) || 0,
    paymentStatus,
    paymentMethod: row.payment_method || "",
    type,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    zatcaStatus: meta?.zatcaStatus || null,
    zatcaUuid: meta?.zatcaUuid || null,
    zatcaQrCode: meta?.zatcaQrCode || null,
  };
}

export interface InvoiceTotals {
  count: number;
  invoices: number;
  estimates: number;
  paid: number;
  unpaid: number;
  revenue: number;
  outstanding: number;
  tax: number;
  zatcaReported: number;
}

export function summarize(invoices: Invoice[]): InvoiceTotals {
  const round = (value: number) => Math.round(value * 100) / 100;
  const real = invoices.filter((i) => i.type === "invoice");

  return {
    count: invoices.length,
    invoices: real.length,
    estimates: invoices.length - real.length,
    paid: real.filter((i) => i.paymentStatus === "paid").length,
    unpaid: real.filter((i) => i.paymentStatus !== "paid").length,
    revenue: round(
      real.filter((i) => i.paymentStatus === "paid").reduce((sum, i) => sum + i.totalAmount, 0)
    ),
    outstanding: round(
      real.filter((i) => i.paymentStatus !== "paid").reduce((sum, i) => sum + i.totalAmount, 0)
    ),
    tax: round(real.reduce((sum, i) => sum + i.taxAmount, 0)),
    zatcaReported: real.filter((i) => i.zatcaStatus === "REPORTED").length,
  };
}

/**
 * `mken_invoices` is an optional table (section 7c of scripts/setup-db.sql), so
 * a project that never enabled invoicing must show an empty state instead of an
 * error.
 */
function isMissingTable(error: { code?: string; message?: string }): boolean {
  return error.code === "PGRST205" || /Could not find the table/i.test(error.message || "");
}

export async function fetchInvoices(
  tenantSlug: string,
  limit = 300
): Promise<{ invoices?: Invoice[]; error?: string; tableMissing?: boolean }> {
  const db = getTenantDb();
  if (!db) return { error: "قاعدة البيانات غير مهيأة على الخادم" };

  const { data, error } = await db
    .from("mken_invoices")
    .select("*")
    .eq("tenant_slug", tenantSlug)
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 1000));

  if (error) {
    if (isMissingTable(error)) return { invoices: [], tableMissing: true };
    return { error: error.message };
  }

  return { invoices: (data as InvoiceRow[]).map(toInvoice) };
}

export async function updateInvoice(
  tenantSlug: string,
  id: string,
  updates: { paymentStatus?: InvoicePaymentStatus; paymentMethod?: string }
): Promise<{ invoice?: Invoice; error?: string; notFound?: boolean }> {
  const db = getTenantDb();
  if (!db) return { error: "قاعدة البيانات غير مهيأة على الخادم" };

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.paymentStatus) patch.payment_status = updates.paymentStatus;
  if (updates.paymentMethod !== undefined) patch.payment_method = updates.paymentMethod;

  const { data, error } = await db
    .from("mken_invoices")
    .update(patch)
    .eq("id", id)
    .eq("tenant_slug", tenantSlug)
    .select("*");

  if (error) {
    if (isMissingTable(error)) {
      return { error: "جدول الفواتير غير مُنشأ في قاعدة البيانات", notFound: true };
    }
    return { error: error.message };
  }
  if (!data?.length) {
    return { error: "الفاتورة غير موجودة أو لا توجد صلاحية تعديل", notFound: true };
  }

  return { invoice: toInvoice(data[0] as InvoiceRow) };
}
