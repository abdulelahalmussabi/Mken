import { NextRequest, NextResponse } from "next/server";
import { resolveTenantScope } from "@/lib/auth/scope";
import {
  getVendors,
  getPurchaseInvoices,
  createVendor,
  updateVendor,
  deleteVendor,
  createPurchaseInvoice,
  deletePurchaseInvoice,
} from "@/lib/mken/purchases";

export async function GET(req: NextRequest) {
  try {
    const scope = resolveTenantScope(req);
    const [vendorsRes, invoicesRes] = await Promise.all([
      getVendors(scope.tenantSlug),
      getPurchaseInvoices(scope.tenantSlug),
    ]);

    return NextResponse.json({
      success: true,
      tenant_slug: scope.tenantSlug,
      vendors: vendorsRes.vendors,
      invoices: invoicesRes.invoices,
      tableMissing: vendorsRes.tableMissing || invoicesRes.tableMissing,
      error: vendorsRes.error || invoicesRes.error,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch purchases data";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const scope = resolveTenantScope(req);
    const body = await req.json();

    if (body.type === "invoice") {
      if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
        return NextResponse.json(
          { success: false, error: "يجب إضافة بند واحد على الأقل لفاتورة المشتريات" },
          { status: 400 }
        );
      }

      const res = await createPurchaseInvoice(scope.tenantSlug, {
        vendor_id: body.vendor_id || null,
        items: body.items,
        total_amount: Number(body.total_amount || 0),
        payment_status: body.payment_status === "paid" ? "paid" : "unpaid",
      });

      if (!res.success) {
        return NextResponse.json({ success: false, error: res.error }, { status: 400 });
      }

      return NextResponse.json({ success: true, invoice: res.invoice }, { status: 201 });
    }

    // Default POST: Create vendor
    if (!body.name || !body.name.trim()) {
      return NextResponse.json(
        { success: false, error: "اسم المورد مطلوب" },
        { status: 400 }
      );
    }

    const res = await createVendor(scope.tenantSlug, {
      name: body.name.trim(),
      contact_person: body.contact_person,
      phone: body.phone,
      email: body.email,
      address: body.address,
    });

    if (!res.success) {
      return NextResponse.json({ success: false, error: res.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, vendor: res.vendor }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create resource";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const scope = resolveTenantScope(req);
    const body = await req.json();

    if (!body.id) {
      return NextResponse.json(
        { success: false, error: "المعرّف (id) مطلوب للتحديث" },
        { status: 400 }
      );
    }

    const { id, ...updates } = body;
    const res = await updateVendor(scope.tenantSlug, id, updates);

    if (!res.success) {
      return NextResponse.json({ success: false, error: res.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, vendor: res.vendor });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update vendor";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const scope = resolveTenantScope(req);
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    const type = url.searchParams.get("type") || "vendor";

    if (!id) {
      return NextResponse.json(
        { success: false, error: "المعرّف (id) مطلوب للحذف" },
        { status: 400 }
      );
    }

    let res;
    if (type === "invoice") {
      res = await deletePurchaseInvoice(scope.tenantSlug, id);
    } else {
      res = await deleteVendor(scope.tenantSlug, id);
    }

    if (!res.success) {
      return NextResponse.json({ success: false, error: res.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to delete resource";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
