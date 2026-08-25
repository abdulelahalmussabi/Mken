/**
 * Vercel Domains API Integration & DNS Helper for MKN SaaS
 */

const VERCEL_API_BASE = "https://api.vercel.com";

interface VercelConfig {
  token?: string;
  projectId?: string;
  teamId?: string;
}

export function getVercelConfig(): VercelConfig {
  return {
    token: process.env.VERCEL_API_TOKEN,
    projectId: process.env.VERCEL_PROJECT_ID,
    teamId: process.env.VERCEL_TEAM_ID,
  };
}

export function isVercelApiConfigured(): boolean {
  const { token, projectId } = getVercelConfig();
  return Boolean(token && projectId);
}

export interface DnsInstruction {
  type: "A" | "CNAME" | "TXT";
  name: string;
  value: string;
  ttl?: string;
  description: string;
}

/**
 * Returns required DNS records for any custom domain on Vercel
 */
export function getRequiredDnsRecords(domain: string): DnsInstruction[] {
  const cleanDomain = domain.trim().toLowerCase();
  const parts = cleanDomain.split(".");
  const isSubdomain = parts.length > 2;

  if (isSubdomain) {
    const subdomainName = parts.slice(0, -2).join(".");
    return [
      {
        type: "CNAME",
        name: subdomainName,
        value: "cname.vercel-dns.com.",
        ttl: "Auto / 3600",
        description: `سجل CNAME يوجه ${cleanDomain} إلى خوادم Vercel`,
      },
    ];
  }

  return [
    {
      type: "A",
      name: "@",
      value: "76.76.21.21",
      ttl: "Auto / 3600",
      description: "سجل A الأساسي لتوجيه النطاق الرئيسي إلى Vercel",
    },
    {
      type: "CNAME",
      name: "www",
      value: "cname.vercel-dns.com.",
      ttl: "Auto / 3600",
      description: `سجل CNAME للنطاق الفرعي www.${cleanDomain}`,
    },
  ];
}

/**
 * Add a domain to the Vercel Project
 */
export async function addDomainToVercel(domain: string): Promise<{
  success: boolean;
  configured: boolean;
  data?: any;
  error?: string;
}> {
  const { token, projectId, teamId } = getVercelConfig();

  if (!token || !projectId) {
    return {
      success: true,
      configured: false,
      error: "مفاتيح Vercel API غير متوفرة. تم حفظ النطاق ويجب ربطه يدوياً من لوحة تحكم Vercel.",
    };
  }

  try {
    const queryParams = new URLSearchParams();
    if (teamId) queryParams.set("teamId", teamId);

    const url = `${VERCEL_API_BASE}/v10/projects/${projectId}/domains${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: domain.trim().toLowerCase() }),
    });

    const data = await res.json();

    if (!res.ok) {
      // If already added to this project, treat as success
      if (data.error?.code === "domain_already_in_use" || data.error?.message?.includes("already exists")) {
        return { success: true, configured: true, data };
      }
      return { success: false, configured: true, error: data.error?.message || "فشل إضافة النطاق إلى Vercel" };
    }

    return { success: true, configured: true, data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ أثناء الاتصال بـ Vercel API";
    return { success: false, configured: true, error: message };
  }
}

/**
 * Check verification status of a domain in Vercel
 */
export async function verifyDomainOnVercel(domain: string): Promise<{
  success: boolean;
  configured: boolean;
  verified: boolean;
  status: string;
  data?: any;
  error?: string;
}> {
  const { token, projectId, teamId } = getVercelConfig();

  if (!token || !projectId) {
    return {
      success: true,
      configured: false,
      verified: false,
      status: "manual",
      error: "مفاتيح Vercel غير متوفرة.",
    };
  }

  try {
    const queryParams = new URLSearchParams();
    if (teamId) queryParams.set("teamId", teamId);

    const url = `${VERCEL_API_BASE}/v9/projects/${projectId}/domains/${encodeURIComponent(domain.trim().toLowerCase())}/verify${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    const data = await res.json();

    if (!res.ok) {
      return {
        success: false,
        configured: true,
        verified: false,
        status: "error",
        error: data.error?.message || "فشل التحقق من النطاق في Vercel",
      };
    }

    const verified = Boolean(data.verified);
    return {
      success: true,
      configured: true,
      verified,
      status: verified ? "active" : "pending_dns",
      data,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ أثناء التحقق من النطاق";
    return { success: false, configured: true, verified: false, status: "error", error: message };
  }
}

/**
 * Remove domain from Vercel Project
 */
export async function removeDomainFromVercel(domain: string): Promise<{
  success: boolean;
  configured: boolean;
  error?: string;
}> {
  const { token, projectId, teamId } = getVercelConfig();

  if (!token || !projectId) {
    return { success: true, configured: false };
  }

  try {
    const queryParams = new URLSearchParams();
    if (teamId) queryParams.set("teamId", teamId);

    const url = `${VERCEL_API_BASE}/v9/projects/${projectId}/domains/${encodeURIComponent(domain.trim().toLowerCase())}${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;

    const res = await fetch(url, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok && res.status !== 404) {
      const data = await res.json();
      return { success: false, configured: true, error: data.error?.message || "فشل حذف النطاق من Vercel" };
    }

    return { success: true, configured: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ أثناء حذف النطاق من Vercel";
    return { success: false, configured: true, error: message };
  }
}
