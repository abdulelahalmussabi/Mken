import { NextResponse } from "next/server";
import { publishDueIgPosts } from "@/lib/mken/instagram-publish";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    const auth = request.headers.get("authorization") || "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await publishDueIgPosts();
  return NextResponse.json({ success: true, ...result });
}
