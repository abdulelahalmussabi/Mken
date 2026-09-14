import { NextResponse } from "next/server";
import { resolveTenantScope } from "@/lib/auth/scope";
import {
  fetchTenantCatalog,
  updateTenantCatalog,
  SERVICES,
  type ActivityOverrides,
  type CatalogUpdate,
  type ServiceOverrides,
  type TenantCatalog,
} from "@/lib/mken/catalog";
import { COMMERCE_ACTIVITY_ID } from "@/lib/mken/saas";
import { tenantSaasFeatures } from "@/lib/mken/saas-guard";

function lockCommerce(catalog: TenantCatalog, hasCommerce: boolean): TenantCatalog {
  if (hasCommerce) {
    return {
      ...catalog,
      activities: catalog.activities.map((activity) =>
        activity.id === COMMERCE_ACTIVITY_ID ? { ...activity, locked: false } : activity
      ),
    };
  }

  return {
    ...catalog,
    activities: catalog.activities.map((activity) =>
      activity.id === COMMERCE_ACTIVITY_ID
        ? { ...activity, enabled: false, locked: true }
        : activity
    ),
    services: catalog.services.map((service) =>
      service.activityId === COMMERCE_ACTIVITY_ID
        ? { ...service, enabled: false, available: false }
        : service
    ),
  };
}

const COMMERCE_SERVICE_IDS = new Set(
  SERVICES.filter((service) => service.activityId === COMMERCE_ACTIVITY_ID).map((s) => s.id)
);

export async function GET(request: Request) {
  const scope = await resolveTenantScope(request);
  if (!scope.slug) {
    return NextResponse.json(
      { success: false, message: scope.message },
      { status: scope.status || 400 }
    );
  }

  const { catalog, error } = await fetchTenantCatalog(scope.slug);
  if (error || !catalog) {
    return NextResponse.json({ success: false, message: error }, { status: 500 });
  }

  const features = await tenantSaasFeatures(scope.slug, scope.session);
  return NextResponse.json({
    success: true,
    tenant: scope.slug,
    ...lockCommerce(catalog, features.hasCommerce),
  });
}

function stringArray(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return undefined;
  return value.filter((v): v is string => typeof v === "string");
}

export async function PUT(request: Request) {
  const scope = await resolveTenantScope(request);
  if (!scope.slug) {
    return NextResponse.json(
      { success: false, message: scope.message },
      { status: scope.status || 400 }
    );
  }

  try {
    const body = await request.json();
    const update: CatalogUpdate = {};

    if (body.enabledActivities !== undefined) {
      const ids = stringArray(body.enabledActivities);
      if (!ids) {
        return NextResponse.json(
          { success: false, message: "enabledActivities يجب أن تكون قائمة معرّفات" },
          { status: 400 }
        );
      }
      update.enabledActivities = ids;
    }

    if (body.enabled !== undefined) {
      const ids = stringArray(body.enabled);
      if (!ids) {
        return NextResponse.json(
          { success: false, message: "enabled يجب أن تكون قائمة معرّفات" },
          { status: 400 }
        );
      }
      update.enabled = ids;
    }

    if (typeof body.featuredActivity === "string") update.featuredActivity = body.featuredActivity;
    if (typeof body.featured === "string") update.featured = body.featured;

    const features = await tenantSaasFeatures(scope.slug, scope.session);
    if (!features.hasCommerce) {
      if (update.enabledActivities) {
        update.enabledActivities = update.enabledActivities.filter((id) => id !== COMMERCE_ACTIVITY_ID);
      }
      if (update.enabled) {
        update.enabled = update.enabled.filter((id) => !COMMERCE_SERVICE_IDS.has(id));
      }
      if (update.featuredActivity === COMMERCE_ACTIVITY_ID) delete update.featuredActivity;
    }

    if (body.activityOverrides && typeof body.activityOverrides === "object") {
      update.activityOverrides = body.activityOverrides as Record<string, ActivityOverrides>;
    }
    if (body.serviceOverrides && typeof body.serviceOverrides === "object") {
      update.serviceOverrides = body.serviceOverrides as Record<string, ServiceOverrides>;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json(
        { success: false, message: "لا توجد حقول للتحديث" },
        { status: 400 }
      );
    }

    const { catalog, error } = await updateTenantCatalog(scope.slug, update);
    if (error || !catalog) {
      return NextResponse.json(
        { success: false, message: error || "تعذّر حفظ الكتالوج" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      tenant: scope.slug,
      ...lockCommerce(catalog, features.hasCommerce),
    });
  } catch {
    return NextResponse.json({ success: false, message: "طلب غير صالح" }, { status: 400 });
  }
}
