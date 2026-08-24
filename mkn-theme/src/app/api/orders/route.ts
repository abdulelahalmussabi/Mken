import { NextResponse } from "next/server";
import { resolveTenantScope } from "@/lib/auth/scope";
import { fetchOrders } from "@/lib/mken/orders";

export async function GET(request: Request) {
  const scope = await resolveTenantScope(request);
  if (!scope.slug) {
    return NextResponse.json(
      { success: false, message: scope.message },
      { status: scope.status || 400 }
    );
  }

  const { orders, error } = await fetchOrders(scope.slug);
  if (error) {
    return NextResponse.json({ success: false, message: error }, { status: 500 });
  }

  return NextResponse.json({ success: true, tenant: scope.slug, orders });
}
