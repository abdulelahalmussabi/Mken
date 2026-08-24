import { NextResponse } from "next/server";
import { gatedTenantScope } from "@/lib/mken/saas-guard";
import { fetchWhatsappLogs, sendCampaignWhatsapp, sendOutboundWhatsapp, sendTestWhatsapp, summarize } from "@/lib/mken/whatsapp";

export async function GET(request: Request) {
  const scope = await gatedTenantScope(request, "whatsapp");
  if (!scope.slug) {
    return NextResponse.json(
      { success: false, message: scope.message },
      { status: scope.status || 400 }
    );
  }

  const limit = Number(new URL(request.url).searchParams.get("limit")) || 300;
  const { logs, error } = await fetchWhatsappLogs(scope.slug, limit);
  if (error || !logs) {
    return NextResponse.json({ success: false, message: error }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    tenant: scope.slug,
    stats: summarize(logs),
    logs,
  });
}

export async function POST(request: Request) {
  const scope = await gatedTenantScope(request, "whatsapp");
  if (!scope.slug) {
    return NextResponse.json(
      { success: false, message: scope.message },
      { status: scope.status || 400 }
    );
  }

  try {
    const body = await request.json();
    if (body.action === "campaign") {
      const result = await sendCampaignWhatsapp(
        scope.slug,
        String(body.target || "all"),
        String(body.body || "")
      );
      if (result.error) {
        return NextResponse.json({ success: false, message: result.error }, { status: 400 });
      }
      return NextResponse.json({ success: true, ...result });
    }

    if (body.action === "crm-reply") {
      const result = await sendOutboundWhatsapp(
        scope.slug,
        String(body.phone || ""),
        String(body.body || ""),
        "crm_reply"
      );
      if (result.error) {
        return NextResponse.json({ success: false, message: result.error }, { status: 400 });
      }
      return NextResponse.json({ success: true });
    }

    const { error } = await sendTestWhatsapp(scope.slug, body.phone || "", body.body || "");
    if (error) {
      return NextResponse.json({ success: false, message: error }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, message: "تعذّر الإرسال" }, { status: 500 });
  }
}
