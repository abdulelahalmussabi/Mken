import { NextResponse } from "next/server";
import { gatedTenantScope } from "@/lib/mken/saas-guard";
import {
  deleteInventoryItem,
  parseInventoryBody,
  updateInventoryItem,
  validateInventory,
} from "@/lib/mken/inventory";

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
    const parsed = parseInventoryBody(await request.json());
    if (typeof parsed === "string") {
      return NextResponse.json({ success: false, message: parsed }, { status: 400 });
    }

    if (Object.keys(parsed).length === 0) {
      return NextResponse.json(
        { success: false, message: "لا توجد حقول للتحديث" },
        { status: 400 }
      );
    }

    const invalid = validateInventory(parsed);
    if (invalid) {
      return NextResponse.json({ success: false, message: invalid }, { status: 400 });
    }

    const { item, error, notFound } = await updateInventoryItem(scope.slug, id, parsed);
    if (error || !item) {
      return NextResponse.json(
        { success: false, message: error || "تعذّر تحديث الصنف" },
        { status: notFound ? 404 : 500 }
      );
    }

    return NextResponse.json({ success: true, item });
  } catch {
    return NextResponse.json({ success: false, message: "طلب غير صالح" }, { status: 400 });
  }
}

export async function DELETE(
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
  const { deleted, error, notFound } = await deleteInventoryItem(scope.slug, id);

  if (!deleted) {
    return NextResponse.json(
      { success: false, message: error || "تعذّر حذف الصنف" },
      { status: notFound ? 404 : 500 }
    );
  }

  return NextResponse.json({ success: true, id });
}
