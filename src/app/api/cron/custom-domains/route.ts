import { NextResponse } from "next/server";
import { suspendExpiredDomains } from "@/lib/mken/custom-domain";
import { purgeExpiredUnclaimedPreviews } from "@/lib/mken/preview";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    const auth = request.headers.get("authorization") || "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await suspendExpiredDomains();
  const previews = await purgeExpiredUnclaimedPreviews();
  return NextResponse.json({ success: true, ...result, unclaimedPurged: previews.deleted, previewError: previews.error });
}
