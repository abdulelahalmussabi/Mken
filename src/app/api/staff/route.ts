import { NextResponse } from "next/server";
import { resolveTenantScope } from "@/lib/auth/scope";
import { createStaff, fetchStaff, parseStaffBody, validateStaff } from "@/lib/mken/staff";

export async function GET(request: Request) {
  const scope = await resolveTenantScope(request);
  if (!scope.slug) {
    return NextResponse.json(
      { success: false, message: scope.message },
      { status: scope.status || 400 }
    );
  }

  const { staff, error } = await fetchStaff(scope.slug);
  if (error || !staff) {
    return NextResponse.json({ success: false, message: error }, { status: 500 });
  }

  return NextResponse.json({ success: true, tenant: scope.slug, staff });
}

export async function POST(request: Request) {
  const scope = await resolveTenantScope(request);
  if (!scope.slug) {
    return NextResponse.json(
      { success: false, message: scope.message },
      { status: scope.status || 400 }
    );
  }

  try {
    const parsed = parseStaffBody(await request.json());
    if (typeof parsed === "string") {
      return NextResponse.json({ success: false, message: parsed }, { status: 400 });
    }

    const invalid = validateStaff(parsed, true);
    if (invalid) {
      return NextResponse.json({ success: false, message: invalid }, { status: 400 });
    }

    const { member, error } = await createStaff(scope.slug, parsed);
    if (error || !member) {
      return NextResponse.json(
        { success: false, message: error || "تعذّر إضافة الموظف" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, member }, { status: 201 });
  } catch {
    return NextResponse.json({ success: false, message: "طلب غير صالح" }, { status: 400 });
  }
}
