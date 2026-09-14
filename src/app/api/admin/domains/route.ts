import { NextResponse } from "next/server";
import { resolveTenantScope } from "@/lib/auth/scope";
import {
  assertCustomDomainEntitled,
  insertDomain,
  listTenantDomains,
  normalizeHostname,
  refreshDomain,
  removeDomain,
} from "@/lib/mken/custom-domain";

export async function GET(request: Request) {
  const scope = await resolveTenantScope(request);
  if (!scope.slug) {
    return NextResponse.json(
      { success: false, message: scope.message },
      { status: scope.status || 400 }
    );
  }

  const entitled = await assertCustomDomainEntitled(scope.slug, scope.session?.role === "super");
  const domains = await listTenantDomains(scope.slug);
  return NextResponse.json({
    success: true,
    tenant: scope.slug,
    entitled: entitled.ok,
    entitledMessage: entitled.ok ? null : entitled.message,
    domains,
  });
}

export async function POST(request: Request) {
  const scope = await resolveTenantScope(request);
  if (!scope.slug || !scope.session) {
    return NextResponse.json(
      { success: false, message: scope.message },
      { status: scope.status || 400 }
    );
  }

  const entitled = await assertCustomDomainEntitled(scope.slug, scope.session.role === "super");
  if (!entitled.ok) {
    return NextResponse.json({ success: false, message: entitled.message }, { status: 403 });
  }

  try {
    const body = (await request.json()) as { action?: string; hostname?: string; id?: string };
    if (body.action === "verify" && body.id) {
      const result = await refreshDomain(body.id, scope.slug);
      if (result.error || !result.domain) {
        return NextResponse.json(
          { success: false, message: result.error || "تعذّر التحقق" },
          { status: 400 }
        );
      }
      return NextResponse.json({ success: true, domain: result.domain });
    }

    const hostname = normalizeHostname(body.hostname || "");
    if (!hostname) {
      return NextResponse.json(
        { success: false, message: "أدخل نطاقاً صالحاً مثل example.com أو www.example.com" },
        { status: 400 }
      );
    }

    const result = await insertDomain({
      slug: scope.slug,
      hostname,
      createdBy: scope.session.email,
    });
    if (result.error || !result.domain) {
      return NextResponse.json(
        { success: false, message: result.error || "تعذّر حفظ النطاق" },
        { status: 400 }
      );
    }
    return NextResponse.json({
      success: true,
      domain: result.domain,
      paired: result.paired || null,
    });
  } catch {
    return NextResponse.json({ success: false, message: "طلب غير صالح" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const scope = await resolveTenantScope(request);
  if (!scope.slug) {
    return NextResponse.json(
      { success: false, message: scope.message },
      { status: scope.status || 400 }
    );
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ success: false, message: "معرّف النطاق مطلوب" }, { status: 400 });
  }

  const result = await removeDomain(id, scope.slug);
  if (result.error) {
    return NextResponse.json({ success: false, message: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
