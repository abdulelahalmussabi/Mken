import { NextResponse } from "next/server";
import { resolveTenantScope } from "@/lib/auth/scope";
import { fetchAppointments } from "@/lib/mken/appointments";

export async function GET(request: Request) {
  const scope = await resolveTenantScope(request);
  if (!scope.slug) {
    return NextResponse.json(
      { success: false, message: scope.message },
      { status: scope.status || 400 }
    );
  }

  const { appointments, error } = await fetchAppointments(scope.slug);
  if (error) {
    return NextResponse.json({ success: false, message: error }, { status: 500 });
  }

  return NextResponse.json({ success: true, tenant: scope.slug, appointments });
}
