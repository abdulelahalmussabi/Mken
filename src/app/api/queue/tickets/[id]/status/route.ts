import { NextResponse } from "next/server";
import { completeTicket } from "@/lib/mken/queue";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const ticketId = params.id;
    const body = await request.json();
    const status = body.status as "completed" | "cancelled" | "no_show";

    if (!["completed", "cancelled", "no_show"].includes(status)) {
      return NextResponse.json(
        { success: false, error: "حالة غير صالحة. الحالات المسموحة: completed, cancelled, no_show" },
        { status: 400 }
      );
    }

    const ticket = await completeTicket(ticketId, status);
    if (!ticket) {
      return NextResponse.json(
        { success: false, error: "التذكرة غير موجودة" },
        { status: 404 }
      );
    }

    const label =
      status === "completed"
        ? "مكتملة الخدمة"
        : status === "cancelled"
        ? "ملغاة (تمت استعادة السعة المقعدية)"
        : "غائب / لم يحضر (تمت استعادة السعة المقعدية)";

    return NextResponse.json({
      success: true,
      ticket,
      message: `تم تحديث التذكرة إلى: ${label}`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "فشل تحديث حالة التذكرة" },
      { status: 500 }
    );
  }
}
