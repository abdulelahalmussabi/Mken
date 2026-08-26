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

  const result = await Promise.race([
    fetchAppointmentsForStaff(session.tenantSlug, session.id, session.activities),
    new Promise<{ appointments?: undefined; error: string }>((resolve) =>
      setTimeout(() => resolve({ error: "انتهت مهلة تحميل المواعيد" }), 8000)
    ),
  ]);
  const { appointments, error } = result;
  if (error) {
    return NextResponse.json({
      success: true,
      staff: session,
      appointments: [],
      message: error,
    });
  }

  return NextResponse.json({
    success: true,
    staff: session,
    appointments: appointments || [],
  });
}
