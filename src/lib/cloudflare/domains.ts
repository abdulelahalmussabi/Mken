/**
 * Cloudflare for SaaS (Custom Hostnames) & Edge SSL Integration for MKN SaaS
 * Provides automated Custom Hostname provisioning, DV SSL certificates, and DNS diagnostics.
 */

export interface CloudflareConfig {
  apiToken?: string;
  zoneId?: string;
  accountId?: string;
  fallbackOrigin: string;
}

export function getCloudflareConfig(): CloudflareConfig {
  return {
    apiToken: process.env.CLOUDFLARE_API_TOKEN,
    zoneId: process.env.CLOUDFLARE_ZONE_ID,
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    fallbackOrigin: process.env.CLOUDFLARE_FALLBACK_ORIGIN || "cname.mken.live",
  };
}

export function isCloudflareConfigured(): boolean {
  const { apiToken, zoneId } = getCloudflareConfig();
  return Boolean(apiToken && zoneId);
}

export interface DnsRecordInstruction {
  type: "CNAME" | "A" | "TXT";
  name: string;
  value: string;
  ttl?: string;
  purpose: string;
  isRecommended?: boolean;
}

/**
 * Returns required DNS records for custom domains on Cloudflare for SaaS
 */
export function getRequiredCloudflareDnsRecords(
  domain: string,
  verificationData?: { txtName?: string; txtValue?: string }
): DnsRecordInstruction[] {
  const cleanDomain = domain.trim().toLowerCase();
  const { fallbackOrigin } = getCloudflareConfig();
  const parts = cleanDomain.split(".");
  const isSubdomain = parts.length > 2;

  const records: DnsRecordInstruction[] = [];

  if (isSubdomain) {
    const subName = parts.slice(0, -2).join(".");
    records.push({
      type: "CNAME",
      name: subName,
      value: fallbackOrigin,
      ttl: "Auto / 3600",
      purpose: `توجيه النطاق الفرعي ${cleanDomain} إلى شبكة مكّن وتوليد شهادة SSL تلقائياً`,
      isRecommended: true,
    });
  } else {
    // Apex / Root Domain
    records.push({
      type: "CNAME",
      name: "@ أو www",
      value: fallbackOrigin,
      ttl: "Auto / 3600",
      purpose: `توجيه النطاق المباشر ${cleanDomain} إلى خوادم مكّن (Cloudflare for SaaS)`,
      isRecommended: true,
    });
    records.push({
      type: "A",
      name: "@",
      value: "172.67.182.1", // Cloudflare SaaS edge proxy fallback IP
      ttl: "Auto / 3600",
      purpose: "سجل A بديل للمسجلين الذين لا يدعمون CNAME Flattening على النطاق الجذري (@)",
      isRecommended: false,
    });
  }

  // Pre-verification TXT challenge if provided by Cloudflare
  if (verificationData?.txtName && verificationData?.txtValue) {
    records.push({
      type: "TXT",
      name: verificationData.txtName,
      value: verificationData.txtValue,
      ttl: "Auto / 3600",
      purpose: "سجل التحقق من ملكية النطاق المسبق الصادر من Cloudflare",
      isRecommended: true,
    });
  }

  return records;
}

/**
 * Add / Provision a Custom Hostname on Cloudflare for SaaS
 */
export async function addDomainToCloudflare(domain: string): Promise<{
  success: boolean;
  configured: boolean;
  hostnameId?: string;
  status?: string;
  sslStatus?: string;
  verificationData?: any;
  data?: any;
  error?: string;
}> {
  const { apiToken, zoneId } = getCloudflareConfig();

  if (!apiToken || !zoneId) {
    return {
      success: true,
      configured: false,
      error: "مفاتيح Cloudflare API غير مضبوطة. تم حفظ النطاق ويجب ربطه يدوياً.",
    };
  }

  const cleanDomain = domain.trim().toLowerCase();

  try {
    const url = `https://api.cloudflare.com/client/v4/zones/${zoneId}/custom_hostnames`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        hostname: cleanDomain,
        ssl: {
          method: "http",
          type: "dv",
          settings: {
            min_tls_version: "1.2",
            http2: "on",
          },
        },
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      // Check if already exists in Cloudflare
      const errMessage = data.errors?.[0]?.message || "";
      if (errMessage.includes("already exists") || data.errors?.[0]?.code === 1406) {
        // Query existing custom hostname ID
        const existing = await findCustomHostname(cleanDomain);
        if (existing) {
          return {
            success: true,
            configured: true,
            hostnameId: existing.id,
            status: existing.status,
            sslStatus: existing.ssl?.status,
            data: existing,
          };
        }
      }
      return {
        success: false,
        configured: true,
        error: errMessage || "فشل إضافة النطاق المخصص إلى Cloudflare for SaaS",
      };
    }

    const result = data.result;
    return {
      success: true,
      configured: true,
      hostnameId: result.id,
      status: result.status,
      sslStatus: result.ssl?.status,
      verificationData: result.ownership_verification || result.ssl?.validation_records,
      data: result,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ أثناء الاتصال بـ Cloudflare API";
    return { success: false, configured: true, error: message };
  }
}

/**
 * Find existing Custom Hostname on Cloudflare
 */
export async function findCustomHostname(domain: string): Promise<any | null> {
  const { apiToken, zoneId } = getCloudflareConfig();
  if (!apiToken || !zoneId) return null;

  try {
    const cleanDomain = domain.trim().toLowerCase();
    const url = `https://api.cloudflare.com/client/v4/zones/${zoneId}/custom_hostnames?hostname=${encodeURIComponent(cleanDomain)}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiToken}`,
      },
    });
    const data = await res.json();
    if (data.success && data.result?.length > 0) {
      return data.result[0];
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Verify / Check Custom Hostname Status on Cloudflare
 */
export async function verifyDomainOnCloudflare(hostnameIdOrDomain: string): Promise<{
  success: boolean;
  configured: boolean;
  verified: boolean;
  status: string;
  sslStatus: string;
  data?: any;
  error?: string;
}> {
  const { apiToken, zoneId } = getCloudflareConfig();

  if (!apiToken || !zoneId) {
    return {
      success: true,
      configured: false,
      verified: false,
      status: "manual",
      sslStatus: "pending",
      error: "مفاتيح Cloudflare غير متوفرة.",
    };
  }

  try {
    let hostnameId = hostnameIdOrDomain;
    // If passed domain name instead of UUID, find ID first
    if (hostnameIdOrDomain.includes(".")) {
      const existing = await findCustomHostname(hostnameIdOrDomain);
      if (!existing) {
        return {
          success: false,
          configured: true,
          verified: false,
          status: "not_found",
          sslStatus: "none",
          error: "النطاق غير مسجل في Cloudflare",
        };
      }
      hostnameId = existing.id;
    }

    const url = `https://api.cloudflare.com/client/v4/zones/${zoneId}/custom_hostnames/${hostnameId}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiToken}`,
      },
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return {
        success: false,
        configured: true,
        verified: false,
        status: "error",
        sslStatus: "error",
        error: data.errors?.[0]?.message || "فشل جلب حالة النطاق من Cloudflare",
      };
    }

    const result = data.result;
    const isHostnameActive = result.status === "active";
    const isSslActive = result.ssl?.status === "active";
    const verified = isHostnameActive && (isSslActive || result.ssl?.status === "pending_validation");

    return {
      success: true,
      configured: true,
      verified,
      status: result.status, // active, pending, etc.
      sslStatus: result.ssl?.status || "pending",
      data: result,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ أثناء فحص حالة النطاق في Cloudflare";
    return {
      success: false,
      configured: true,
      verified: false,
      status: "error",
      sslStatus: "error",
      error: message,
    };
  }
}

/**
 * Remove Custom Hostname from Cloudflare
 */
export async function removeDomainFromCloudflare(hostnameIdOrDomain: string): Promise<{
  success: boolean;
  configured: boolean;
  error?: string;
}> {
  const { apiToken, zoneId } = getCloudflareConfig();
  if (!apiToken || !zoneId) {
    return { success: true, configured: false };
  }

  try {
    let hostnameId = hostnameIdOrDomain;
    if (hostnameIdOrDomain.includes(".")) {
      const existing = await findCustomHostname(hostnameIdOrDomain);
      if (!existing) return { success: true, configured: true };
      hostnameId = existing.id;
    }

    const url = `https://api.cloudflare.com/client/v4/zones/${zoneId}/custom_hostnames/${hostnameId}`;
    const res = await fetch(url, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${apiToken}`,
      },
    });

    const data = await res.json();
    if (!res.ok && res.status !== 404 && !data.success) {
      return {
        success: false,
        configured: true,
        error: data.errors?.[0]?.message || "فشل حذف النطاق من Cloudflare",
      };
    }

    return { success: true, configured: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ أثناء حذف النطاق من Cloudflare";
    return { success: false, configured: true, error: message };
  }
}

/**
 * Live DNS Resolution Check using DNS-over-HTTPS (DoH) via Cloudflare
 * Fast, reliable, client-and-edge compatible DNS live diagnostics.
 */
export async function checkLiveDnsResolution(domain: string): Promise<{
  resolved: boolean;
  cnameRecords: string[];
  aRecords: string[];
  pointsToMkn: boolean;
  rawDetails: any;
}> {
  const cleanDomain = domain.trim().toLowerCase();
  const { fallbackOrigin } = getCloudflareConfig();

  try {
    // 1. Check CNAME
    const cnameRes = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(cleanDomain)}&type=CNAME`,
      { headers: { accept: "application/dns-json" } }
    );
    const cnameData = await cnameRes.json();
    const cnameAnswers: string[] = (cnameData.Answer || []).map((a: any) =>
      (a.data || "").replace(/\.$/, "")
    );

    // 2. Check A Record
    const aRes = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(cleanDomain)}&type=A`,
      { headers: { accept: "application/dns-json" } }
    );
    const aData = await aRes.json();
    const aAnswers: string[] = (aData.Answer || [])
      .filter((a: any) => a.type === 1)
      .map((a: any) => a.data);

    const pointsToMkn =
      cnameAnswers.some(
        (ans) =>
          ans.includes(fallbackOrigin) ||
          ans.includes("mken.live") ||
          ans.includes("vercel-dns.com")
      ) || aAnswers.length > 0;

    return {
      resolved: cnameAnswers.length > 0 || aAnswers.length > 0,
      cnameRecords: cnameAnswers,
      aRecords: aAnswers,
      pointsToMkn,
      rawDetails: { cname: cnameData, a: aData },
    };
  } catch (error) {
    return {
      resolved: false,
      cnameRecords: [],
      aRecords: [],
      pointsToMkn: false,
      rawDetails: { error: String(error) },
    };
  }
}
