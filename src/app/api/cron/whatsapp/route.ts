import { NextResponse } from "next/server";
import { runWhatsappCron } from "@/lib/mken/cron-whatsapp";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    const auth = request.headers.get("authorization") || "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await runWhatsappCron();
  if (result.error) {
    return NextResponse.json({ success: false, ...result }, { status: 500 });
  }
  return NextResponse.json({ success: true, ...result });
}
