import { NextResponse } from "next/server";
import { clearStaffCookie, readStaffSession } from "@/lib/auth/session";

export async function GET() {
  const session = await readStaffSession();
  return NextResponse.json({ success: true, session });
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  clearStaffCookie(response);
  return response;
}
