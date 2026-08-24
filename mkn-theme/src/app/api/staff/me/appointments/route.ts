import { NextResponse } from "next/server";
import { readStaffSession } from "@/lib/auth/session";
import { fetchAppointmentsForStaff } from "@/lib/mken/appointments";

export async function GET() {
  const session = await readStaffSession();
  if (!session) {
    return NextResponse.json(
      { success: false, message: "الجلسة منتهية، يرجى تسجيل الدخول" },
      { status: 401 }
    );
  }

  const { appointments, error } = await fetchAppointmentsForStaff(
    session.tenantSlug,
    session.id,
    session.activities
  );
  if (error) {
    return NextResponse.json({ success: false, message: error }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    staff: session,
    appointments: appointments || [],
  });
}
