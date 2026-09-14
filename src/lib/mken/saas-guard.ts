import { resolveTenantScope } from "@/lib/auth/scope";
import type { AdminSession } from "@/lib/auth/session";
import { fetchTenantRow } from "@/lib/mken/tenant";
import {
  saasFeaturesFromConfig,
  SAAS_FEATURE_MESSAGES,
  SAAS_FEATURES_LOCKED,
  SAAS_FEATURES_UNLIMITED,
  type SaasFeatures,
} from "@/lib/mken/saas";

export type SaasGateFeature = "whatsapp" | "commerce" | "invoices";

export async function featuresForSession(session: AdminSession): Promise<SaasFeatures> {
  if (session.role === "super") return SAAS_FEATURES_UNLIMITED;
  if (!session.clientSlug) return SAAS_FEATURES_LOCKED;
  const row = await fetchTenantRow(session.clientSlug);
  return saasFeaturesFromConfig(row?.config_data, { slug: session.clientSlug });
}

export async function tenantSaasFeatures(
  slug: string,
  session?: AdminSession | null
): Promise<SaasFeatures> {
  if (session?.role === "super") return SAAS_FEATURES_UNLIMITED;
  const row = await fetchTenantRow(slug);
  return saasFeaturesFromConfig(row?.config_data, { slug, superAdmin: false });
}

export async function gatedTenantScope(request: Request, feature: SaasGateFeature) {
  const scope = await resolveTenantScope(request);
  if (!scope.slug) return scope;

  const features = await tenantSaasFeatures(scope.slug, scope.session);
  const allowed =
    feature === "whatsapp"
      ? features.hasWhatsApp
      : feature === "commerce"
        ? features.hasCommerce
        : features.hasInvoices;

  if (allowed) return scope;
  return { status: 403, message: SAAS_FEATURE_MESSAGES[feature] };
}
