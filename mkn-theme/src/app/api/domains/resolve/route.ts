import { NextResponse } from "next/server";
import { resolveActiveCustomHost } from "@/lib/mken/custom-domain";
import { slugFromCustomHostname } from "@/lib/mken/tenant-host";

export async function GET(request: Request) {
  const host = new URL(request.url).searchParams.get("host") || "";
  const slug = slugFromCustomHostname(host) || (await resolveActiveCustomHost(host));
  if (!slug) {
    return NextResponse.json({ success: false, slug: null }, { status: 404 });
  }
  return NextResponse.json({ success: true, slug });
}
