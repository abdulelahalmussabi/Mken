import { NextRequest, NextResponse } from "next/server";
import { updateTenantSettings } from "@/lib/mken/settings";

const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v2/userinfo";

/**
 * GET /api/google-business/callback
 * Public OAuth callback route for Google Business Profile connection.
 * Receives code from Google, exchanges it for tokens, saves connection to database, and redirects.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") || "almahrusa"; // state maps to tenant_slug
  const error = url.searchParams.get("error");

  const host = req.headers.get("host") || "mken.live";
  const protocol = host.includes("localhost") ? "http" : "https";
  const redirectBase = `${protocol}://${host}`;

  // 1. Handle user cancellation or OAuth error
  if (error) {
    console.error("[Google OAuth Callback Error]:", error);
    const redirectUrl = new URL("/admin/settings", redirectBase);
    redirectUrl.searchParams.set("google_connect", "error");
    redirectUrl.searchParams.set("message", error);
    return NextResponse.redirect(redirectUrl);
  }

  // 2. Validate missing authorization code
  if (!code) {
    const redirectUrl = new URL("/admin/settings", redirectBase);
    redirectUrl.searchParams.set("google_connect", "error");
    redirectUrl.searchParams.set("message", "missing_code");
    return NextResponse.redirect(redirectUrl);
  }

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
    const defaultRedirectUri = `${redirectBase}/api/google-business/callback`;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || defaultRedirectUri;

    if (!clientId || !clientSecret) {
      console.error("[Google OAuth Error]: Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET");
      const redirectUrl = new URL("/admin/settings", redirectBase);
      redirectUrl.searchParams.set("google_connect", "error");
      redirectUrl.searchParams.set("message", "missing_credentials");
      return NextResponse.redirect(redirectUrl);
    }

    // 3. Exchange authorization code for tokens
    const tokenResponse = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || tokenData.error) {
      console.error("[Google OAuth Token Exchange Failed]:", tokenData);
      const redirectUrl = new URL("/admin/settings", redirectBase);
      redirectUrl.searchParams.set("google_connect", "error");
      redirectUrl.searchParams.set("message", tokenData.error_description || tokenData.error || "token_exchange_failed");
      return NextResponse.redirect(redirectUrl);
    }

    const { access_token, refresh_token, expires_in, scope, id_token } = tokenData;

    // 4. Optionally fetch user/account info from Google UserInfo API
    let accountName = "";
    let accountEmail = "";
    try {
      if (access_token) {
        const userInfoRes = await fetch(GOOGLE_USERINFO_ENDPOINT, {
          headers: { Authorization: `Bearer ${access_token}` },
        });
        if (userInfoRes.ok) {
          const userInfo = await userInfoRes.json();
          accountName = userInfo.name || userInfo.email || "";
          accountEmail = userInfo.email || "";
        }
      }
    } catch (userInfoErr) {
      console.warn("[Google UserInfo Fetch Warning]:", userInfoErr);
    }

    // 5. Calculate token expiry timestamp
    const tokenExpiry = expires_in
      ? new Date(Date.now() + expires_in * 1000).toISOString()
      : null;

    // 6. Save connection & tokens to Supabase for the specified tenant (state)
    const tenantSlug = state.trim().toLowerCase();
    const updateRes = await updateTenantSettings(tenantSlug, {
      google_connected: true,
      google_access_token: access_token,
      google_refresh_token: refresh_token || "",
      google_token_expiry: tokenExpiry,
      google_scope: scope,
      google_account_name: accountName,
      google_account_email: accountEmail,
      google_connected_at: new Date().toISOString(),
    });

    if (!updateRes.success) {
      console.error("[Google OAuth Save Settings Error]:", updateRes.error);
    }

    // 7. Redirect to Admin Settings with success query parameter
    const redirectUrl = new URL("/admin/settings", redirectBase);
    redirectUrl.searchParams.set("google_connect", "success");
    if (accountName) {
      redirectUrl.searchParams.set("account", accountName);
    }

    return NextResponse.redirect(redirectUrl);
  } catch (err: unknown) {
    console.error("[Google OAuth Callback Unexpected Error]:", err);
    const redirectUrl = new URL("/admin/settings", redirectBase);
    redirectUrl.searchParams.set("google_connect", "error");
    redirectUrl.searchParams.set("message", "unexpected_error");
    return NextResponse.redirect(redirectUrl);
  }
}
