import { NextResponse } from "next/server";
import { gatedTenantScope } from "@/lib/mken/saas-guard";
import {
  INVOICE_PAYMENT_STATUSES,
  updateInvoice,
  type InvoicePaymentStatus,
} from "@/lib/mken/invoices";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const scope = await gatedTenantScope(request, "invoices");
  if (!scope.slug) {
    return NextResponse.json(
      { success: false, message: scope.message },
      { status: scope.status || 400 }
    );
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const updates: { paymentStatus?: InvoicePaymentStatus; paymentMethod?: string } = {};

    if (body.paymentStatus !== undefined) {
      if (!(INVOICE_PAYMENT_STATUSES as readonly string[]).includes(body.paymentStatus)) {
        return NextResponse.json(
          { success: false, message: "حالة دفع غير صحيحة" },
          { status: 400 }
        );
      }
      updates.paymentStatus = body.paymentStatus;
    }

    if (typeof body.paymentMethod === "string") updates.paymentMethod = body.paymentMethod.trim();

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, message: "لا توجد حقول للتحديث" },
        { status: 400 }
      );
    }

    const { invoice, error, notFound } = await updateInvoice(scope.slug, id, updates);
    if (error || !invoice) {
      return NextResponse.json(
        { success: false, message: error || "تعذّر تحديث الفاتورة" },
        { status: notFound ? 404 : 500 }
      );
    }

    return NextResponse.json({ success: true, invoice });
  } catch {
    return NextResponse.json({ success: false, message: "طلب غير صالح" }, { status: 400 });
  }
}
