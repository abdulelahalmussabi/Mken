import { NextResponse } from "next/server";
import { dispatchDueReviewRequests } from "@/lib/mken/review-funnel";
import { publishDueGbpPosts } from "@/lib/mken/gbp";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    const auth = request.headers.get("authorization") || "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await dispatchDueReviewRequests();
  const gbp = await publishDueGbpPosts();
  if (result.error) {
    return NextResponse.json({ success: false, ...result, gbp }, { status: 500 });
  }
  return NextResponse.json({ success: true, ...result, gbp });
}
