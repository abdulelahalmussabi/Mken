import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { resolveBoundTenantFromHostname } from "@/lib/mken/bound-host";
import { isUsableLogoSrc, publicMediaSrc } from "@/lib/mken/logo-crop";
import { loadStorefrontSeo } from "@/lib/mken/seo";
import { hostnameFromHeaders } from "@/lib/mken/tenant-host";
import { canonicalTenantSlug, fetchPlatformBrand, isPlatformSlug } from "@/lib/mken/tenant";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CACHE = "public, max-age=300, stale-while-revalidate=86400";

function imageResponse(body: Buffer, contentType: string): NextResponse {
  const bytes = Uint8Array.from(body);
  const payload = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return new NextResponse(payload as ArrayBuffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": CACHE,
    },
  });
}

async function platformPng(): Promise<NextResponse> {
  const file = await readFile(path.join(process.cwd(), "public", "brand", "mken.png"));
  return imageResponse(file, "image/png");
}

function dataUrlResponse(logo: string): NextResponse | null {
  const match = logo.trim().match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) return null;
  try {
    const body = Buffer.from(match[2].replace(/\s+/g, ""), "base64");
    if (!body.length) return null;
    return imageResponse(body, match[1]);
  } catch {
    return null;
  }
}

function redirectLogo(request: Request, logo: string): NextResponse {
  const trimmed = logo.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return NextResponse.redirect(trimmed, 302);
  }
  const absolute = publicMediaSrc(trimmed);
  if (/^https?:\/\//i.test(absolute)) {
    return NextResponse.redirect(absolute, 302);
  }
  const origin = new URL(request.url).origin;
  const pathName = absolute.startsWith("/") ? absolute : `/${absolute}`;
  return NextResponse.redirect(new URL(pathName, origin), 302);
}

async function respondWithLogo(request: Request, logo: string | undefined | null): Promise<NextResponse> {
  const trimmed = (logo || "").trim();
  if (!isUsableLogoSrc(trimmed)) return platformPng();
  if (trimmed.startsWith("data:image/")) {
    return dataUrlResponse(trimmed) || platformPng();
  }
  return redirectLogo(request, trimmed);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug?: string[] }> }
) {
  try {
    const requested = canonicalTenantSlug((await params).slug?.[0] || "");
    const bound = await resolveBoundTenantFromHostname(hostnameFromHeaders(request.headers));
    if (bound && requested && bound !== requested) {
      const client = await loadStorefrontSeo(bound);
      return respondWithLogo(request, client?.logo);
    }

    const slug = bound || requested;
    if (!slug || isPlatformSlug(slug) || slug === "mken") {
      const brand = await fetchPlatformBrand();
      return respondWithLogo(request, brand.logo);
    }

    const client = await loadStorefrontSeo(slug);
    return respondWithLogo(request, client?.logo);
  } catch {
    return platformPng();
  }
}
