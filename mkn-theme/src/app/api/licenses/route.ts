import { NextResponse } from "next/server";
import { readAdminSession } from "@/lib/auth/session";
import { issueLicense, listLicenses, setLicenseStatus, type LicenseStatus } from "@/lib/mken/licenses";

async function requireSuper() {
  const session = await readAdminSession();
  if (!session) {
    return NextResponse.json({ success: false, message: "الجلسة منتهية، يرجى تسجيل الدخول" }, { status: 401 });
  }
  if (session.role !== "super") {
    return NextResponse.json({ success: false, message: "إدارة التراخيص للسوبر أدمن فقط" }, { status: 403 });
  }
  return null;
}

export async function GET(request: Request) {
  const denied = await requireSuper();
  if (denied) return denied;

  const url = new URL(request.url);
  const { licenses, error } = await listLicenses(url.searchParams.get("status") || "", url.searchParams.get("q") || "");
  if (error || !licenses) {
    return NextResponse.json({ success: false, message: error }, { status: 500 });
  }
  return NextResponse.json({ success: true, licenses });
}

export async function POST(request: Request) {
  const denied = await requireSuper();
  if (denied) return denied;

  try {
    const body = await request.json();
    const action = typeof body.action === "string" ? body.action : "issue";

    if (action === "issue") {
      const { license, error } = await issueLicense(body);
      if (error || !license) {
        return NextResponse.json({ success: false, message: error }, { status: 400 });
      }
      return NextResponse.json({ success: true, license }, { status: 201 });
    }

    const statusMap: Record<string, LicenseStatus> = {
      suspend: "suspended",
      resume: "active",
      revoke: "revoked",
    };
    const status = statusMap[action];
    if (!status) {
      return NextResponse.json({ success: false, message: "طلب غير صالح" }, { status: 400 });
    }

    const { error } = await setLicenseStatus(body.licenseKey || "", status);
    if (error) {
      return NextResponse.json({ success: false, message: error }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, message: "تعذّر معالجة الطلب" }, { status: 500 });
  }
}
