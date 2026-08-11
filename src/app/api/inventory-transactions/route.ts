import { NextRequest, NextResponse } from "next/server";
import { resolveTenantScope } from "@/lib/auth/scope";
import {
  getDetailedInventoryTransactions,
  createDetailedTransaction,
} from "@/lib/mken/inventory-transactions";

export async function GET(req: NextRequest) {
  try {
    const scope = resolveTenantScope(req);
    const url = new URL(req.url);
    const typeFilter = url.searchParams.get("type") || undefined;
    const itemIdFilter = url.searchParams.get("item_id") || undefined;

    const res = await getDetailedInventoryTransactions(
      scope.tenantSlug,
      typeFilter,
      itemIdFilter
    );

    return NextResponse.json({
      success: true,
      tenant_slug: scope.tenantSlug,
      transactions: res.transactions,
      tableMissing: res.tableMissing,
      error: res.error,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch transactions";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const scope = resolveTenantScope(req);
    const body = await req.json();

    if (!body.item_id || !body.type || typeof body.quantity !== "number" || body.quantity <= 0) {
      return NextResponse.json(
        { success: false, error: "بيانات الحركة غير مكتملة (item_id, type, quantity)" },
        { status: 400 }
      );
    }

    const res = await createDetailedTransaction(scope.tenantSlug, {
      item_id: body.item_id,
      type: body.type,
      quantity: body.quantity,
      reference_id: body.reference_id || null,
      notes: body.notes || null,
    });

    if (!res.success) {
      return NextResponse.json({ success: false, error: res.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, transaction: res.transaction }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to record transaction";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
