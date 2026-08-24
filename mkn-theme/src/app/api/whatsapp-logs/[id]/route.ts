import { NextResponse } from "next/server";
import { gatedTenantScope } from "@/lib/mken/saas-guard";
import { deleteWhatsappLog } from "@/lib/mken/whatsapp";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const scope = await gatedTenantScope(request, "whatsapp");
  if (!scope.slug) {
    return NextResponse.json(
      { success: false, message: scope.message },
      { status: scope.status || 400 }
    );
  }

  const { id } = await params;
  const { deleted, error, notFound } = await deleteWhatsappLog(scope.slug, id);

  if (!deleted) {
    return NextResponse.json(
      { success: false, message: error || "تعذّر حذف السجل" },
      { status: notFound ? 404 : 500 }
    );
  }

  return NextResponse.json({ success: true, id });
}
