import { NextResponse } from "next/server";
import { resolveBoundTenantFromHostname } from "@/lib/mken/bound-host";
import { hostnameFromHeaders } from "@/lib/mken/tenant-host";

export async function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get("host") || "";
  const requestHost = hostnameFromHeaders(request.headers);
  const bound = await resolveBoundTenantFromHostname(requestHost);
  const slug = await resolveBoundTenantFromHostname(requested || requestHost);
  if (!slug || (bound && slug !== bound)) {
    if (bound) return NextResponse.json({ success: true, slug: bound, bound: true });
    return NextResponse.json({ success: false, slug: null }, { status: 404 });
  }
  return NextResponse.json({ success: true, slug, bound: Boolean(bound) });
}
