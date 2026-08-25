import { NextRequest, NextResponse } from "next/server";
import { resolveTenantScope } from "@/lib/auth/scope";
import {
  getInventoryItems,
  getInventoryTransactions,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  recordInventoryTransaction,
} from "@/lib/mken/inventory";

export async function GET(req: NextRequest) {
  try {
    const scope = resolveTenantScope(req);
    const [itemsResult, txResult] = await Promise.all([
      getInventoryItems(scope.tenantSlug),
      getInventoryTransactions(scope.tenantSlug),
    ]);

    return NextResponse.json({
      success: true,
      tenant_slug: scope.tenantSlug,
      items: itemsResult.items,
      transactions: txResult.transactions,
      tableMissing: itemsResult.tableMissing || txResult.tableMissing,
      error: itemsResult.error || txResult.error,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch inventory";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const scope = resolveTenantScope(req);
    const body = await req.json();

    if (body.action === "transaction") {
      if (!body.item_id || !body.type || typeof body.quantity !== "number") {
        return NextResponse.json(
          { success: false, error: "بيانات الحركة المخزنية غير مكتملة (item_id, type, quantity)" },
          { status: 400 }
        );
      }

      const res = await recordInventoryTransaction(scope.tenantSlug, {
        item_id: body.item_id,
        type: body.type,
        quantity: body.quantity,
        reference_id: body.reference_id,
        notes: body.notes,
      });

      if (!res.success) {
        return NextResponse.json({ success: false, error: res.error }, { status: 400 });
      }

      return NextResponse.json({ success: true, transaction: res.transaction });
    }

    // Default POST: Create item
    if (!body.name) {
      return NextResponse.json(
        { success: false, error: "اسم المنتج مطلوب" },
        { status: 400 }
      );
    }

    const res = await createInventoryItem(scope.tenantSlug, {
      name: body.name,
      sku: body.sku,
      barcode: body.barcode,
      cost_price: Number(body.cost_price || 0),
      sell_price: Number(body.sell_price || 0),
      quantity: Number(body.quantity || 0),
      min_stock_alert: Number(body.min_stock_alert || 0),
      image_url: body.image_url,
    });

    if (!res.success) {
      return NextResponse.json({ success: false, error: res.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, item: res.item }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create inventory item";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const scope = resolveTenantScope(req);
    const body = await req.json();

    if (!body.id) {
      return NextResponse.json(
        { success: false, error: "معرّف المنتج (id) مطلوب للتحديث" },
        { status: 400 }
      );
    }

    const { id, ...updates } = body;
    const res = await updateInventoryItem(scope.tenantSlug, id, updates);

    if (!res.success) {
      return NextResponse.json({ success: false, error: res.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, item: res.item });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update inventory item";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const scope = resolveTenantScope(req);
    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "معرّف المنتج (id) مطلوب للحذف" },
        { status: 400 }
      );
    }

    const res = await deleteInventoryItem(scope.tenantSlug, id);

    if (!res.success) {
      return NextResponse.json({ success: false, error: res.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to delete inventory item";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
