import { NextResponse } from "next/server";
import { resolveTenantScope } from "@/lib/auth/scope";
import {
  ORDER_PAYMENT_STATUSES,
  ORDER_STATUSES,
  updateOrder,
  type OrderPaymentStatus,
  type OrderStatus,
} from "@/lib/mken/orders";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const scope = await resolveTenantScope(request);
  if (!scope.slug) {
    return NextResponse.json(
      { success: false, message: scope.message },
      { status: scope.status || 400 }
    );
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const updates: {
      status?: OrderStatus;
      paymentStatus?: OrderPaymentStatus;
      notes?: string;
    } = {};

    if (body.status !== undefined) {
      if (!(ORDER_STATUSES as readonly string[]).includes(body.status)) {
        return NextResponse.json({ success: false, message: "حالة غير صحيحة" }, { status: 400 });
      }
      updates.status = body.status;
    }

    if (body.paymentStatus !== undefined) {
      if (!(ORDER_PAYMENT_STATUSES as readonly string[]).includes(body.paymentStatus)) {
        return NextResponse.json(
          { success: false, message: "حالة دفع غير صحيحة" },
          { status: 400 }
        );
      }
      updates.paymentStatus = body.paymentStatus;
    }

    if (typeof body.notes === "string") updates.notes = body.notes;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, message: "لا توجد حقول للتحديث" },
        { status: 400 }
      );
    }

    const { order, error, notFound } = await updateOrder(scope.slug, id, updates);
    if (error || !order) {
      return NextResponse.json(
        { success: false, message: error || "تعذّر تحديث الطلب" },
        { status: notFound ? 404 : 500 }
      );
    }

    return NextResponse.json({ success: true, order });
  } catch {
    return NextResponse.json({ success: false, message: "طلب غير صالح" }, { status: 400 });
  }
}
