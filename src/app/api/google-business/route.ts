import { NextRequest, NextResponse } from "next/server";
import { resolveTenantScope } from "@/lib/auth/scope";
import { getTenantSettings, updateTenantSettings } from "@/lib/mken/settings";

const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const DEFAULT_SCOPES = [
  "https://www.googleapis.com/auth/business.manage",
  "openid",
  "email",
  "profile",
].join(" ");

/**
 * GET /api/google-business
 * - Returns current Google Business integration status
 * - Or returns OAuth auth_url if requested (e.g. ?action=auth_url)
 */
export async function GET(req: NextRequest) {
  try {
    const scope = resolveTenantScope(req);
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");

    const clientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
    
    // Determine callback URL
    const host = req.headers.get("host") || "mken.live";
    const protocol = host.includes("localhost") ? "http" : "https";
    const defaultRedirectUri = `${protocol}://${host}/api/google-business/callback`;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || defaultRedirectUri;

    // 1. Generate Auth URL for initiating OAuth flow
    if (action === "auth_url") {
      if (!clientId) {
        return NextResponse.json(
          {
            success: false,
            error: "لم يتم ضبط GOOGLE_CLIENT_ID في متغيرات البيئة.",
          },
          { status: 400 }
        );
      }

      const state = searchParams.get("state") || scope.tenantSlug;

      const authUrlParams = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: DEFAULT_SCOPES,
        access_type: "offline",
        prompt: "consent",
        include_granted_scopes: "true",
        state: state,
      });

      const authUrl = `${GOOGLE_AUTH_ENDPOINT}?${authUrlParams.toString()}`;

      return NextResponse.json({
        success: true,
        auth_url: authUrl,
        redirect_uri: redirectUri,
      });
    }

    // 2. Fetch current status
    const { settings } = await getTenantSettings(scope.tenantSlug);

    const isConnected = !!(settings.google_connected && settings.google_access_token);

    return NextResponse.json({
      success: true,
      tenant_slug: scope.tenantSlug,
      google_connected: isConnected,
      google_account_id: settings.google_account_id || null,
      google_account_name: settings.google_account_name || null,
      google_location_id: settings.google_location_id || null,
      google_last_sync: settings.google_last_sync || null,
      redirect_uri: redirectUri,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error fetching Google Business status";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * POST /api/google-business
 * Update location settings or disconnect account
 */
export async function POST(req: NextRequest) {
  try {
    const scope = resolveTenantScope(req);
    const body = await req.json();
    const { action, location_id, account_id } = body;

    // Disconnect Google account
    if (action === "disconnect") {
      const updateRes = await updateTenantSettings(scope.tenantSlug, {
        google_connected: false,
        google_access_token: "",
        google_refresh_token: "",
        google_account_id: "",
        google_account_name: "",
        google_location_id: "",
        google_connected_at: null,
      });

      if (!updateRes.success) {
        return NextResponse.json({ success: false, error: updateRes.error }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        message: "تم فصل حساب Google Business بنجاح.",
      });
    }

    // Update location / account selection
    if (action === "update_location") {
      const updateRes = await updateTenantSettings(scope.tenantSlug, {
        google_location_id: location_id || "",
        google_account_id: account_id || "",
        google_last_sync: new Date().toISOString(),
      });

      if (!updateRes.success) {
        return NextResponse.json({ success: false, error: updateRes.error }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        message: "تم تحديث فرع Google Business بنجاح.",
        settings: updateRes.settings,
      });
    }

    return NextResponse.json({ success: false, error: "طلب غير معروف" }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error updating Google Business settings";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
