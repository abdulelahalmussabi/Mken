import { NextResponse } from "next/server";
import { gatedTenantScope } from "@/lib/mken/saas-guard";
import {
  createInventoryItem,
  fetchInventory,
  parseInventoryBody,
  summarize,
  validateInventory,
} from "@/lib/mken/inventory";

export async function GET(request: Request) {
  const scope = await gatedTenantScope(request, "invoices");
  if (!scope.slug) {
    return NextResponse.json(
      { success: false, message: scope.message },
      { status: scope.status || 400 }
    );
  }

  const { items, error, tableMissing } = await fetchInventory(scope.slug);
  if (error || !items) {
    return NextResponse.json({ success: false, message: error }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    tenant: scope.slug,
    tableMissing: tableMissing || false,
    totals: summarize(items),
    items,
  });
}

export async function POST(request: Request) {
  const scope = await gatedTenantScope(request, "invoices");
  if (!scope.slug) {
    return NextResponse.json(
      { success: false, message: scope.message },
      { status: scope.status || 400 }
    );
  }

  try {
    const parsed = parseInventoryBody(await request.json());
    if (typeof parsed === "string") {
      return NextResponse.json({ success: false, message: parsed }, { status: 400 });
    }

    const invalid = validateInventory(parsed, true);
    if (invalid) {
      return NextResponse.json({ success: false, message: invalid }, { status: 400 });
    }

    const { item, error } = await createInventoryItem(scope.slug, parsed);
    if (error || !item) {
      return NextResponse.json(
        { success: false, message: error || "تعذّر إضافة الصنف" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, item }, { status: 201 });
  } catch {
    return NextResponse.json({ success: false, message: "طلب غير صالح" }, { status: 400 });
  }
}
