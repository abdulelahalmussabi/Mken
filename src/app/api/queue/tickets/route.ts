import { NextResponse } from "next/server";
import { getQueueState, issueTicket, resolveTenantFromRequest, type PriorityCategory } from "@/lib/mken/queue";

export async function GET(request: Request) {
  try {
    const tenantSlug = resolveTenantFromRequest(request);
    const state = await getQueueState(tenantSlug);
    return NextResponse.json({ success: true, ...state });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "فشل جلب بيانات الطابور" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const tenantSlug = resolveTenantFromRequest(request);
    const body = await request.json();
    const departmentId = body.departmentId || "reception";
    const departmentName = body.departmentName;
    const customerName = body.customerName;
    const customerPhone = body.customerPhone;
    const priorityCategory = (body.priorityCategory as PriorityCategory) || "none";
    const staffUserId = body.staffUserId || null;

    // Self-service issued tickets (QR or mobile) are strictly 'none' (standard)
    // Only authenticated staff can directly issue priority
    const ticket = await issueTicket({
      tenantSlug,
      departmentId,
      departmentName,
      customerName,
      customerPhone,
      priorityCategory,
      staffUserId,
    });

    return NextResponse.json({
      success: true,
      ticket,
      message:
        ticket.priorityCategory !== "none"
          ? "تم إصدار تذكرة رعاية / أولوية بنجاح"
          : "تم إصدار تذكرتك بنجاح، يرجى متابعة الشاشة المركزية أو جوالك",
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "تعذّر إصدار التذكرة" }, { status: 400 });
  }
}
