import { NextRequest, NextResponse } from "next/server";
import { resolveTenantScope } from "@/lib/auth/scope";
import {
  getCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from "@/lib/mken/customers";

export async function GET(req: NextRequest) {
  try {
    const scope = resolveTenantScope(req);
    const result = await getCustomers(scope.tenantSlug);

    return NextResponse.json({
      success: true,
      tenant_slug: scope.tenantSlug,
      customers: result.customers,
      tableMissing: result.tableMissing,
      error: result.error,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch customers";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const scope = resolveTenantScope(req);
    const body = await req.json();

    if (!body.name || !body.name.trim()) {
      return NextResponse.json(
        { success: false, error: "اسم العميل مطلوب" },
        { status: 400 }
      );
    }

    const res = await createCustomer(scope.tenantSlug, {
      name: body.name.trim(),
      phone: body.phone,
      email: body.email,
      address: body.address,
    });

    if (!res.success) {
      return NextResponse.json({ success: false, error: res.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, customer: res.customer }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create customer";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const scope = resolveTenantScope(req);
    const body = await req.json();

    if (!body.id) {
      return NextResponse.json(
        { success: false, error: "معرّف العميل (id) مطلوب للتحديث" },
        { status: 400 }
      );
    }

    const { id, ...updates } = body;
    const res = await updateCustomer(scope.tenantSlug, id, updates);

    if (!res.success) {
      return NextResponse.json({ success: false, error: res.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, customer: res.customer });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update customer";
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
        { success: false, error: "معرّف العميل (id) مطلوب للحذف" },
        { status: 400 }
      );
    }

    const res = await deleteCustomer(scope.tenantSlug, id);

    if (!res.success) {
      return NextResponse.json({ success: false, error: res.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to delete customer";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
