import { NextResponse } from "next/server";
import { resolveTenantScope } from "@/lib/auth/scope";
import {
  APPOINTMENT_STATUSES,
  PAYMENT_STATUSES,
  updateAppointment,
  type AppointmentStatus,
  type PaymentStatus,
} from "@/lib/mken/appointments";

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
      status?: AppointmentStatus;
      notes?: string;
      paymentStatus?: PaymentStatus;
    } = {};

    if (body.status !== undefined) {
      if (!(APPOINTMENT_STATUSES as readonly string[]).includes(body.status)) {
        return NextResponse.json({ success: false, message: "حالة غير صحيحة" }, { status: 400 });
      }
      updates.status = body.status;
    }

    if (body.paymentStatus !== undefined) {
      if (!(PAYMENT_STATUSES as readonly string[]).includes(body.paymentStatus)) {
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

    const { appointment, error } = await updateAppointment(scope.slug, id, updates);
    if (error || !appointment) {
      return NextResponse.json(
        { success: false, message: error || "تعذّر تحديث الموعد" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, appointment });
  } catch {
    return NextResponse.json({ success: false, message: "طلب غير صالح" }, { status: 400 });
  }
}
