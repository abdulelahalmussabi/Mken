import { NextRequest, NextResponse } from "next/server";
import { resolveTenantScope } from "@/lib/auth/scope";
import { createClient } from "@/lib/supabase/client";
import {
  isVercelApiConfigured,
  getRequiredDnsRecords,
  addDomainToVercel,
  verifyDomainOnVercel,
  removeDomainFromVercel,
} from "@/lib/vercel/domains";

export async function GET(req: NextRequest) {
  try {
    const scope = resolveTenantScope(req);
    const tenantSlug = scope.tenantSlug;
    const supabase = createClient();

    // 1. Fetch domain from mken_tenant_domains
    const { data: domainData } = await supabase
      .from("mken_tenant_domains")
      .select("*")
      .eq("tenant_slug", tenantSlug)
      .maybeSingle();

    const domain = domainData?.domain || "";
    const dnsRecords = domain ? getRequiredDnsRecords(domain) : [];
    const isVercelConfigured = isVercelApiConfigured();

    return NextResponse.json({
      success: true,
      tenant_slug: tenantSlug,
      domain: domainData?.domain || null,
      verified: domainData?.verified || false,
      status: domainData?.status || "pending_dns",
      dnsRecords,
      isVercelConfigured,
      domainRecord: domainData || null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ أثناء استرجاع بيانات النطاق";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const scope = resolveTenantScope(req);
    const tenantSlug = scope.tenantSlug;
    const body = await req.json();
    let rawDomain = (body.domain || "").trim().toLowerCase();

    // Remove protocol and paths if entered by mistake (e.g., https://rewa.care/ -> rewa.care)
    rawDomain = rawDomain.replace(/^https?:\/\//i, "").split("/")[0].split(":")[0];

    if (!rawDomain) {
      return NextResponse.json({ success: false, error: "يرجى إدخال اسم النطاق بشكل صحيح" }, { status: 400 });
    }

    const supabase = createClient();

    // 1. Check if domain is already registered to another tenant
    const { data: existing } = await supabase
      .from("mken_tenant_domains")
      .select("tenant_slug, domain")
      .eq("domain", rawDomain)
      .maybeSingle();

    if (existing && existing.tenant_slug !== tenantSlug) {
      return NextResponse.json(
        { success: false, error: "هذا النطاق مرتبط بمنشأة أخرى بالفعل" },
        { status: 400 }
      );
    }

    // 2. Add to Vercel project if API token is configured
    const isVercelConfigured = isVercelApiConfigured();
    let vercelResult = null;
    let initialStatus = "pending_dns";
    let isVerified = false;

    if (isVercelConfigured) {
      vercelResult = await addDomainToVercel(rawDomain);
      if (!vercelResult.success && !vercelResult.error?.includes("already exists")) {
        return NextResponse.json(
          { success: false, error: vercelResult.error || "فشل تسجيل النطاق في Vercel" },
          { status: 400 }
        );
      }

      // Check immediate verification
      const verifyRes = await verifyDomainOnVercel(rawDomain);
      if (verifyRes.verified) {
        initialStatus = "active";
        isVerified = true;
      }
    }

    // 3. Upsert into mken_tenant_domains
    const { data: savedRecord, error: dbError } = await supabase
      .from("mken_tenant_domains")
      .upsert(
        {
          tenant_slug: tenantSlug,
          domain: rawDomain,
          verified: isVerified,
          status: initialStatus,
          dns_verification_data: vercelResult?.data || {},
          updated_at: new Date().toISOString(),
        },
        { onConflict: "domain" }
      )
      .select()
      .single();

    if (dbError) {
      // If table missing or RLS error, also try updating mken_saas_clients
      try {
        await supabase
          .from("mken_saas_clients")
          .update({ custom_domain: rawDomain })
          .eq("tenant_slug", tenantSlug);
      } catch {}
    } else {
      // Keep mken_saas_clients in sync
      try {
        await supabase
          .from("mken_saas_clients")
          .update({ custom_domain: rawDomain })
          .eq("tenant_slug", tenantSlug);
      } catch {}
    }

    const dnsRecords = getRequiredDnsRecords(rawDomain);

    return NextResponse.json({
      success: true,
      message: isVercelConfigured
        ? "تم ربط النطاق مع Vercel بنجاح. أكمل إعداد سجلات DNS."
        : "تم حفظ النطاق بنجاح. يرجى إضافة سجلات DNS وربطه من لوحة تحكم Vercel يدوياً.",
      domain: rawDomain,
      verified: isVerified,
      status: initialStatus,
      dnsRecords,
      isVercelConfigured,
      domainRecord: savedRecord || null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ أثناء حفظ النطاق";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const scope = resolveTenantScope(req);
    const tenantSlug = scope.tenantSlug;
    const supabase = createClient();

    // 1. Get current domain
    const { data: domainData } = await supabase
      .from("mken_tenant_domains")
      .select("*")
      .eq("tenant_slug", tenantSlug)
      .maybeSingle();

    if (!domainData || !domainData.domain) {
      return NextResponse.json({ success: false, error: "لا يوجد نطاق مخصص محفوظ للمنشأة" }, { status: 400 });
    }

    const domain = domainData.domain;
    const isVercelConfigured = isVercelApiConfigured();

    if (!isVercelConfigured) {
      return NextResponse.json({
        success: true,
        verified: domainData.verified || false,
        status: domainData.status || "pending_dns",
        isVercelConfigured: false,
        message: "مفاتيح Vercel API غير مضبوطة. يتم التحقق يدوياً عبر لوحة تحكم Vercel.",
        dnsRecords: getRequiredDnsRecords(domain),
      });
    }

    // Verify against Vercel API
    const verifyRes = await verifyDomainOnVercel(domain);

    const newStatus = verifyRes.verified ? "active" : "pending_dns";
    await supabase
      .from("mken_tenant_domains")
      .update({
        verified: verifyRes.verified,
        status: newStatus,
        dns_verification_data: verifyRes.data || domainData.dns_verification_data,
        updated_at: new Date().toISOString(),
      })
      .eq("domain", domain);

    return NextResponse.json({
      success: true,
      verified: verifyRes.verified,
      status: newStatus,
      isVercelConfigured: true,
      message: verifyRes.verified
        ? "تهانينا! النطاق مفعل ومربوط بنجاح وهو يعمل الآن."
        : "سجلات DNS ما زالت قيد النشر، قد يستغرق ذلك بضع دقائق.",
      dnsRecords: getRequiredDnsRecords(domain),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ أثناء التحقق من النطاق";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const scope = resolveTenantScope(req);
    const tenantSlug = scope.tenantSlug;
    const supabase = createClient();

    const { data: domainData } = await supabase
      .from("mken_tenant_domains")
      .select("domain")
      .eq("tenant_slug", tenantSlug)
      .maybeSingle();

    if (domainData?.domain) {
      // Remove from Vercel if configured
      if (isVercelApiConfigured()) {
        await removeDomainFromVercel(domainData.domain);
      }

      // Delete from mken_tenant_domains
      await supabase.from("mken_tenant_domains").delete().eq("domain", domainData.domain);

      // Clear from mken_saas_clients
      await supabase
        .from("mken_saas_clients")
        .update({ custom_domain: null })
        .eq("tenant_slug", tenantSlug);
    }

    return NextResponse.json({
      success: true,
      message: "تم حذف النطاق المخصص بنجاح. سيعمل رابط المنشأة الافتراضي {slug}.mken.live كالمعتاد.",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ أثناء حذف النطاق";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
