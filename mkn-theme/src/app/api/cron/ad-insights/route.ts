import { NextResponse } from "next/server";
import { syncAdCampaignInsights } from "@/lib/mken/ads";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    const auth = request.headers.get("authorization") || "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await syncAdCampaignInsights();
  if (result.error) {
    return NextResponse.json({ success: false, ...result }, { status: 500 });
  }
  return NextResponse.json({ success: true, ...result });
}
