import { NextResponse } from "next/server";
import { callNextTicket, formatArabicTTS } from "@/lib/mken/queue";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const tenantSlug = body.tenantSlug || "default";
    const counterId = body.counterId || "كاونتر 1";
    const departmentId = body.departmentId || "all";
    const staffUserId = body.staffUserId || "staff-agent-1";

    const result = await callNextTicket({
      tenantSlug,
      counterId,
      departmentId,
      staffUserId,
    });

    if (!result.ticket) {
      return NextResponse.json({
        success: false,
        ticket: null,
        message: result.dispatchReason,
        consecutivePriorityCalls: result.consecutivePriorityCalls,
      });
    }

    const ttsVoiceText = formatArabicTTS(result.ticket.ticketNumber, counterId);

    return NextResponse.json({
      success: true,
      ticket: result.ticket,
      consecutivePriorityCalls: result.consecutivePriorityCalls,
      dispatchReason: result.dispatchReason,
      ttsVoiceText,
      message: `تم استدعاء ${result.ticket.ticketNumber} إلى ${counterId}`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "تعذّر استدعاء التذكرة التالية" },
      { status: 500 }
    );
  }
}
