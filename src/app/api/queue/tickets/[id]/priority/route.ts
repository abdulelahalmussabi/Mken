import { NextResponse } from "next/server";
import { updateTicketPriority, type PriorityCategory } from "@/lib/mken/queue";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const ticketId = params.id;
    const body = await request.json();

    const priorityCategory = body.priorityCategory as PriorityCategory;
    const staffUserId = body.staffUserId || "staff-override-active";
    const reason = body.reason;

    if (!["none", "elderly", "special_needs"].includes(priorityCategory)) {
      return NextResponse.json(
        { success: false, error: "فئة أولوية غير صالحة. الخيارات المتاحة: none, elderly, special_needs" },
        { status: 400 }
      );
    }

    const { ticket, message } = await updateTicketPriority({
      ticketId,
      priorityCategory,
      staffUserId,
      reason,
    });

    return NextResponse.json({
      success: true,
      ticket,
      message,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "فشل تحديث فئة التذكرة" },
      { status: 400 }
    );
  }
}
