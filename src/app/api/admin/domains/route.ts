import { NextRequest, NextResponse } from "next/server";
import { resolveTenantScope } from "@/lib/auth/scope";
import { createClient } from "@/lib/supabase/client";
import {
  isCloudflareConfigured,
  getRequiredCloudflareDnsRecords,
  addDomainToCloudflare,
  verifyDomainOnCloudflare,
  removeDomainFromCloudflare,
  checkLiveDnsResolution,
} from "@/lib/cloudflare/domains";
import {
  isVercelApiConfigured,
  getRequiredDnsRecords as getVercelDnsRecords,
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
    const isCfConfigured = isCloudflareConfigured();
    const isVercelConfigured = isVercelApiConfigured();

    let dnsRecords: any[] = [];
    if (domain) {
      dnsRecords = isCfConfigured
        ? getRequiredCloudflareDnsRecords(domain, domainData?.dns_verification_data)
        : getVercelDnsRecords(domain);
    }

    return NextResponse.json({
      success: true,
      tenant_slug: tenantSlug,
      domain: domainData?.domain || null,
      verified: domainData?.verified || false,
      status: domainData?.status || "pending_dns",
      ssl_status: domainData?.dns_verification_data?.ssl_status || (domainData?.verified ? "active" : "pending"),
      dnsRecords,
      isCloudflareConfigured: isCfConfigured,
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

    // Clean domain (strip protocol, ports, and trailing slashes)
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

    const isCfConfigured = isCloudflareConfigured();
    const isVercelConfigured = isVercelApiConfigured();

    let initialStatus = "pending_dns";
    let isVerified = false;
    let cfResult: any = null;
    let vercelResult: any = null;
    let verificationData: any = {};

    // 2. Provision on Cloudflare for SaaS (Primary)
    if (isCfConfigured) {
      cfResult = await addDomainToCloudflare(rawDomain);
      if (cfResult.success) {
        if (cfResult.status === "active") {
          initialStatus = "active";
          isVerified = true;
        }
        verificationData = {
          provider: "cloudflare",
          hostname_id: cfResult.hostnameId,
          cf_status: cfResult.status,
          ssl_status: cfResult.sslStatus,
          raw: cfResult.data,
        };
      }
    }

    // 3. Fallback / Co-provision on Vercel
    if (isVercelConfigured) {
      vercelResult = await addDomainToVercel(rawDomain);
      if (vercelResult.success) {
        const verifyRes = await verifyDomainOnVercel(rawDomain);
        if (verifyRes.verified) {
          initialStatus = "active";
          isVerified = true;
        }
        verificationData.vercel = vercelResult.data;
      }
    }

    // 4. Upsert into mken_tenant_domains
    const { data: savedRecord, error: dbError } = await supabase
      .from("mken_tenant_domains")
      .upsert(
        {
          tenant_slug: tenantSlug,
          domain: rawDomain,
          verified: isVerified,
          status: initialStatus,
          dns_verification_data: verificationData,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "domain" }
      )
      .select()
      .single();

    if (!dbError) {
      try {
        await supabase
          .from("mken_saas_clients")
          .update({ custom_domain: rawDomain })
          .eq("tenant_slug", tenantSlug);
      } catch {}
    }

    const dnsRecords = isCfConfigured
      ? getRequiredCloudflareDnsRecords(rawDomain, cfResult?.verificationData)
      : getVercelDnsRecords(rawDomain);

    return NextResponse.json({
      success: true,
      message: isCfConfigured || isVercelConfigured
        ? "تم تسجيل النطاق بنجاح وتجهيز شهادة SSL التلقائية. يرجى ضبط سجلات الـ DNS."
        : "تم حفظ النطاق بنجاح. أضف سجلات الـ DNS لتفعيل التوجيه.",
      domain: rawDomain,
      verified: isVerified,
      status: initialStatus,
      dnsRecords,
      isCloudflareConfigured: isCfConfigured,
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
    const isCfConfigured = isCloudflareConfigured();
    const isVercelConfigured = isVercelApiConfigured();

    // 2. Perform Live DNS Resolution Check (DoH)
    const liveDns = await checkLiveDnsResolution(domain);

    let isVerified = domainData.verified || false;
    let newStatus = domainData.status || "pending_dns";
    let sslStatus = domainData.dns_verification_data?.ssl_status || "pending";
    let updatedVerificationData = { ...domainData.dns_verification_data, live_dns: liveDns };

    // 3. Verify with Cloudflare for SaaS
    if (isCfConfigured) {
      const hostnameId = domainData.dns_verification_data?.hostname_id || domain;
      const cfRes = await verifyDomainOnCloudflare(hostnameId);

      if (cfRes.success) {
        isVerified = cfRes.verified;
        newStatus = cfRes.status === "active" ? "active" : "pending_dns";
        sslStatus = cfRes.sslStatus;
        updatedVerificationData.cf_status = cfRes.status;
        updatedVerificationData.ssl_status = cfRes.sslStatus;
        updatedVerificationData.raw = cfRes.data;
      }
    } else if (isVercelConfigured) {
      const verifyRes = await verifyDomainOnVercel(domain);
      isVerified = verifyRes.verified;
      newStatus = verifyRes.verified ? "active" : "pending_dns";
      sslStatus = verifyRes.verified ? "active" : "pending";
      updatedVerificationData.vercel = verifyRes.data;
    } else {
      // Fallback verification based purely on Live DNS check
      if (liveDns.pointsToMkn) {
        isVerified = true;
        newStatus = "active";
        sslStatus = "active";
      }
    }

    // 4. Update Database
    await supabase
      .from("mken_tenant_domains")
      .update({
        verified: isVerified,
        status: newStatus,
        dns_verification_data: updatedVerificationData,
        updated_at: new Date().toISOString(),
      })
      .eq("domain", domain);

    const dnsRecords = isCfConfigured
      ? getRequiredCloudflareDnsRecords(domain)
      : getVercelDnsRecords(domain);

    return NextResponse.json({
      success: true,
      verified: isVerified,
      status: newStatus,
      ssl_status: sslStatus,
      liveDns,
      isCloudflareConfigured: isCfConfigured,
      isVercelConfigured,
      message: isVerified
        ? "تهانينا! النطاق مفعل ومربوط بنجاح وشهادة الـ SSL نشطة الآن."
        : "سجلات DNS ما زالت قيد النشر، قد يستغرق ذلك بضع دقائق إضافية.",
      dnsRecords,
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
      .select("domain, dns_verification_data")
      .eq("tenant_slug", tenantSlug)
      .maybeSingle();

    if (domainData?.domain) {
      const domain = domainData.domain;

      // 1. Remove from Cloudflare
      if (isCloudflareConfigured()) {
        const hostnameId = domainData.dns_verification_data?.hostname_id || domain;
        await removeDomainFromCloudflare(hostnameId);
      }

      // 2. Remove from Vercel
      if (isVercelApiConfigured()) {
        await removeDomainFromVercel(domain);
      }

      // 3. Delete from database
      await supabase.from("mken_tenant_domains").delete().eq("domain", domain);

      // 4. Clear from mken_saas_clients
      try {
        await supabase
          .from("mken_saas_clients")
          .update({ custom_domain: null })
          .eq("tenant_slug", tenantSlug);
      } catch {}
    }

    return NextResponse.json({
      success: true,
      message: "تم حذف النطاق المخصص بنجاح. سيعمل رابط المنشأة الافتراضي كالمعتاد.",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ أثناء حذف النطاق";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
