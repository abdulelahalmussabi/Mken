import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getTenantSettings } from "@/lib/mken/settings";

/**
 * GET /api/whatsapp-webhook
 * Webhook Verification Handler (Meta Cloud API / Twilio)
 * Responds to Meta's hub.challenge verification challenge.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN || process.env.NEXT_PUBLIC_WHATSAPP_VERIFY_TOKEN || "mken_verify_token";

  // Verify challenge token from Meta
  if (mode === "subscribe" && token === expectedToken) {
    console.log("[WhatsApp Webhook Verification Success]: challenge verified");
    return new Response(challenge || "OK", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  // Fallback for simple status/ping check
  if (!mode && !token) {
    return NextResponse.json({
      status: "online",
      service: "Mken WhatsApp Webhook",
      timestamp: new Date().toISOString(),
    });
  }

  console.warn("[WhatsApp Webhook Verification Failed]: Token mismatch", { mode, token });
  return new Response("Verification failed: Token mismatch", { status: 403 });
}

/**
 * POST /api/whatsapp-webhook
 * Inbound WhatsApp Message Handler
 * Accepts webhook payloads from Meta Cloud API, UltraMsg, Evolution API, and custom providers.
 */
export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const tenantSlug = (
      url.searchParams.get("tenant") ||
      url.searchParams.get("client") ||
      url.searchParams.get("tenant_slug") ||
      "almahrusa"
    ).trim().toLowerCase();

    // 1. Read raw body for HMAC signature verification
    const rawBody = await req.text();
    const signature = req.headers.get("x-hub-signature-256");
    const appSecret = process.env.WHATSAPP_APP_SECRET || process.env.WHATSAPP_WEBHOOK_SECRET;

    // 2. Validate Meta HMAC signature if secret & header are present
    if (appSecret && signature) {
      const expectedSignature = `sha256=${crypto
        .createHmac("sha256", appSecret)
        .update(rawBody)
        .digest("hex")}`;

      if (signature !== expectedSignature) {
        console.error("[WhatsApp Webhook HMAC Signature Mismatch]");
        return NextResponse.json({ success: false, error: "Invalid HMAC signature" }, { status: 401 });
      }
    }

    // 3. Parse JSON payload
    let payload: any = {};
    try {
      payload = JSON.parse(rawBody);
    } catch (parseErr) {
      console.error("[WhatsApp Webhook JSON Parse Error]:", parseErr);
      return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }

    // 4. Fetch tenant settings to check configuration & status
    const { settings } = await getTenantSettings(tenantSlug);

    console.log(`[WhatsApp Inbound Webhook Received] Tenant: ${tenantSlug}`, {
      hasPayload: !!payload,
      provider: settings.whatsapp_provider || "default",
    });

    // 5. Process Meta Cloud API Payload Structure
    if (payload.object === "whatsapp_business_account" && Array.isArray(payload.entry)) {
      for (const entry of payload.entry) {
        if (Array.isArray(entry.changes)) {
          for (const change of entry.changes) {
            const value = change.value;
            if (value && Array.isArray(value.messages)) {
              for (const message of value.messages) {
                const fromPhone = message.from;
                const messageType = message.type;
                const textBody = message.text?.body || message.caption || "";

                console.log(`[Meta Inbound Message] From: ${fromPhone}, Text: ${textBody}`);
                // Inbound message pipeline integration (AI response, auto-responder, status update)
              }
            }
          }
        }
      }
    }

    // 6. Process UltraMsg / Evolution / Taqnyat Payload Structure
    if (payload.data || payload.message || payload.body) {
      const fromPhone = payload.data?.from || payload.from || payload.phone || "";
      const textBody = payload.data?.body || payload.body || payload.message || "";

      if (fromPhone || textBody) {
        console.log(`[Standard Provider Message] From: ${fromPhone}, Text: ${textBody}`);
      }
    }

    // Return 200 OK to notify provider of receipt
    return NextResponse.json({
      success: true,
      received: true,
      tenant_slug: tenantSlug,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error processing WhatsApp webhook";
    console.error("[WhatsApp Webhook Error]:", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
