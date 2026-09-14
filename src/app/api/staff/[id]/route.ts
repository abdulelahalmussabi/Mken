import { NextResponse } from "next/server";
import { resolveTenantScope } from "@/lib/auth/scope";
import { deleteStaff, parseStaffBody, updateStaff, validateStaff } from "@/lib/mken/staff";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const scope = await resolveTenantScope(request);
  if (!scope.slug) {
    return NextResponse.json(
      { success: false, message: scope.message },
      { status: scope.status || 400 }
    );
  }

  const { id } = await params;

  try {
    const parsed = parseStaffBody(await request.json());
    if (typeof parsed === "string") {
      return NextResponse.json({ success: false, message: parsed }, { status: 400 });
    }

    if (Object.keys(parsed).length === 0) {
      return NextResponse.json(
        { success: false, message: "لا توجد حقول للتحديث" },
        { status: 400 }
      );
    }

    const invalid = validateStaff(parsed);
    if (invalid) {
      return NextResponse.json({ success: false, message: invalid }, { status: 400 });
    }

    const { member, error, notFound } = await updateStaff(scope.slug, id, parsed);
    if (error || !member) {
      return NextResponse.json(
        { success: false, message: error || "تعذّر تحديث الموظف" },
        { status: notFound ? 404 : 500 }
      );
    }

    return NextResponse.json({ success: true, member });
  } catch {
    return NextResponse.json({ success: false, message: "طلب غير صالح" }, { status: 400 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const scope = await resolveTenantScope(request);
  if (!scope.slug) {
    return NextResponse.json(
      { success: false, message: scope.message },
      { status: scope.status || 400 }
    );
  }

  const { id } = await params;
  const { deleted, error, notFound } = await deleteStaff(scope.slug, id);

  if (!deleted) {
    return NextResponse.json(
      { success: false, message: error || "تعذّر حذف الموظف" },
      { status: notFound ? 404 : 500 }
    );
  }

  return NextResponse.json({ success: true, id });
}
