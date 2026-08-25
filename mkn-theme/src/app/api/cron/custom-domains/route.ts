import { NextResponse } from "next/server";
import { suspendExpiredDomains } from "@/lib/mken/custom-domain";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    const auth = request.headers.get("authorization") || "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await suspendExpiredDomains();
  return NextResponse.json({ success: true, ...result });
}
