const TENANT_SLUG_ALIASES: Record<string, string> = {
  almahrousa: "almahrusa",
  almahrosa: "almahrusa",
  mahrousa: "almahrusa",
};

export function canonicalTenantSlug(slug: string | undefined | null): string {
  const key = (slug || "").trim().toLowerCase();
  return TENANT_SLUG_ALIASES[key] || key;
}
