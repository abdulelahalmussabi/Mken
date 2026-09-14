import { NextResponse } from "next/server";
import { resolveTenantScope } from "@/lib/auth/scope";
import {
  APPOINTMENT_STATUSES,
  PAYMENT_STATUSES,
  updateAppointment,
  type AppointmentStatus,
  type PaymentStatus,
} from "@/lib/mken/appointments";
import { sendMetaCapiEvent } from "@/lib/mken/meta-ads";
import { sendOutboundWhatsapp } from "@/lib/mken/whatsapp";

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
      cancelAction?: "approve" | "reject";
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

    if (body.cancelAction === "approve" || body.cancelAction === "reject") {
      updates.cancelAction = body.cancelAction;
    }

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

    if (updates.paymentStatus === "paid") {
      void sendMetaCapiEvent({
        eventName: "Purchase",
        slug: scope.slug,
        phone: appointment.phone,
        eventId: `pay_${appointment.id}`,
        value: appointment.paymentAmount || undefined,
      });
    }

    if (updates.cancelAction === "approve" && appointment.phone) {
      void sendOutboundWhatsapp(
        scope.slug,
        appointment.phone,
        "تم اعتماد إلغاء موعدك. المبلغ المدفوع يبقى إلى حين معالجة الاسترداد من المنشأة إن وُجد.",
        "confirmation",
        { appointmentId: appointment.id }
      );
    }
    if (updates.cancelAction === "reject" && appointment.phone) {
      void sendOutboundWhatsapp(
        scope.slug,
        appointment.phone,
        "لم يُعتمد طلب إلغاء موعدك. يبقى الموعد مؤكداً في موعده.",
        "confirmation",
        { appointmentId: appointment.id }
      );
    }

    return NextResponse.json({ success: true, appointment });
  } catch {
    return NextResponse.json({ success: false, message: "طلب غير صالح" }, { status: 400 });
  }
}
