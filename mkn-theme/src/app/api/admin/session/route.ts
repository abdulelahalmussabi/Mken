import { NextResponse } from "next/server";
import { clearSessionCookie, readAdminSession } from "@/lib/auth/session";
import { featuresForSession } from "@/lib/mken/saas-guard";

export async function GET() {
  const session = await readAdminSession();
  const features = session ? await featuresForSession(session) : null;
  return NextResponse.json({ success: true, session, features });
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  clearSessionCookie(response);
  return response;
}
