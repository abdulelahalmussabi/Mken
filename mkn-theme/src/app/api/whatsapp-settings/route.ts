import { NextResponse } from "next/server";
import { gatedTenantScope } from "@/lib/mken/saas-guard";
import { fetchWhatsappApi, saveWhatsappApi, type WhatsappApiPublic } from "@/lib/mken/whatsapp";

export async function GET(request: Request) {
  const scope = await gatedTenantScope(request, "whatsapp");
  if (!scope.slug) {
    return NextResponse.json(
      { success: false, message: scope.message },
      { status: scope.status || 400 }
    );
  }

  const { config, error } = await fetchWhatsappApi(scope.slug);
  if (error || !config) {
    return NextResponse.json({ success: false, message: error }, { status: 500 });
  }
  return NextResponse.json({ success: true, tenant: scope.slug, config });
}

export async function PUT(request: Request) {
  const scope = await gatedTenantScope(request, "whatsapp");
  if (!scope.slug) {
    return NextResponse.json(
      { success: false, message: scope.message },
      { status: scope.status || 400 }
    );
  }

  try {
    const body = (await request.json()) as Partial<WhatsappApiPublic> & {
      token?: string;
      gatewayToken?: string;
    };
    const { config, error } = await saveWhatsappApi(scope.slug, body);
    if (error || !config) {
      return NextResponse.json({ success: false, message: error }, { status: 500 });
    }
    return NextResponse.json({ success: true, config });
  } catch {
    return NextResponse.json({ success: false, message: "طلب غير صالح" }, { status: 400 });
  }
}
