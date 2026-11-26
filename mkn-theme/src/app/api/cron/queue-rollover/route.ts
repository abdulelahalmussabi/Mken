import { createRequire } from "node:module";
import { NextResponse } from "next/server";

const require = createRequire(import.meta.url);
const queuePersist = require("../../../../server/platform/_lib/queue-persist");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 21:05 UTC = 00:05 Asia/Riyadh. Backup for the lazy rollover on queue requests.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    const auth = request.headers.get("authorization") || "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await queuePersist.rolloverAll();
    const extra = result && typeof result === "object" ? result : { result };
    return NextResponse.json({ success: true, ...extra });
  } catch (error) {
    console.error("queue rollover cron:", error);
    return NextResponse.json({ success: false, message: "Queue rollover failed" }, { status: 500 });
  }
}
