import { NextResponse } from "next/server";
import { getServiceRoleDb } from "@/lib/mken/tenant";

const ONLINE_WINDOW_MINUTES = 5;

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tenantSlug = (url.searchParams.get("tenant") || url.searchParams.get("slug") || "").trim();
  const activityId = (url.searchParams.get("activity") || "").trim();

  if (!tenantSlug) {
    return NextResponse.json({ error: "tenant (slug) is required" }, { status: 400 });
  }
  if (!activityId) {
    return NextResponse.json({ error: "activity is required" }, { status: 400 });
  }

  const supabase = getServiceRoleDb();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase credentials missing" }, { status: 500 });
  }

  try {
    const { data: links, error: linkErr } = await supabase
      .from("mken_staff_activities")
      .select("staff_id")
      .eq("tenant_slug", tenantSlug)
      .eq("activity_id", activityId);

    if (linkErr) throw linkErr;
    if (!links?.length) {
      return NextResponse.json({
        tenant: tenantSlug,
        activity: activityId,
        available: [],
        total: 0,
        message: "No staff linked to this activity",
      });
    }

    const staffIds = links.map((row: { staff_id: string }) => row.staff_id);
    const { data: staffRows, error: staffErr } = await supabase
      .from("mken_staff")
      .select("id, name, phone, role, status, availability, last_seen_at, current_chat_load")
      .in("id", staffIds)
      .eq("tenant_slug", tenantSlug)
      .eq("status", "active");

    if (staffErr) throw staffErr;

    const now = Date.now();
    const windowMs = ONLINE_WINDOW_MINUTES * 60 * 1000;
    const online = (staffRows || [])
      .filter((row: { availability?: string; last_seen_at?: string | null }) => {
        if (row.availability !== "online" || !row.last_seen_at) return false;
        return now - new Date(row.last_seen_at).getTime() <= windowMs;
      })
      .map(
        (row: {
          id: string;
          name: string;
          phone: string;
          role: string;
          current_chat_load?: number;
        }) => ({
          id: row.id,
          name: row.name,
          phone: row.phone,
          role: row.role,
          currentLoad: row.current_chat_load || 0,
        })
      )
      .sort((a: { currentLoad: number }, b: { currentLoad: number }) => a.currentLoad - b.currentLoad);

    return NextResponse.json({
      tenant: tenantSlug,
      activity: activityId,
      available: online,
      total: online.length,
      onlineWindowMinutes: ONLINE_WINDOW_MINUTES,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return NextResponse.json(
      { error: "Failed to fetch staff availability", details: message },
      { status: 500 }
    );
  }
}
