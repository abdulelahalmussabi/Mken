import { NextResponse } from "next/server";
import { loadPlatformMeasuredStats } from "@/lib/mken/measured-stats";

export const dynamic = "force-dynamic";

export async function GET() {
  const stats = await loadPlatformMeasuredStats();
  return NextResponse.json(
    { success: true, ...stats },
    {
      headers: {
        "Cache-Control": "public, max-age=900, stale-while-revalidate=1800",
      },
    }
  );
}
