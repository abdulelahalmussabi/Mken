import { NextRequest, NextResponse } from "next/server";
import { applySubscriptionUpdate } from "@/lib/mken/billing";
import { attributeSubscriptionConversion } from "@/lib/mken/affiliate";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();

    // 1. Identify event type (Moyasar / Stripe)
    let tenantSlug = rawBody.metadata?.tenant_slug || rawBody.tenant_slug || "rewa";
    let planTier = (rawBody.metadata?.plan_tier || rawBody.plan || "pro") as any;
    let status: "active" | "past_due" | "canceled" = "active";
    let amountPaid = Number(rawBody.amount || rawBody.data?.object?.amount_total || 0) / 100;
    let referrerCode = rawBody.metadata?.ref || rawBody.ref;

    // Handle Moyasar Payment Webhook
    if (rawBody.type === "payment.paid" || rawBody.status === "paid") {
      status = "active";
    } else if (rawBody.type === "payment.failed" || rawBody.status === "failed") {
      status = "past_due";
    }

    // Handle Stripe Subscription Webhook
    if (rawBody.type === "customer.subscription.deleted") {
      status = "canceled";
    }

    // 2. Apply subscription update and limits
    const updateResult = await applySubscriptionUpdate({
      tenantSlug,
      planTier,
      status,
      amountPaid,
      paymentProvider: rawBody.source?.type || "moyasar",
    });

    // 3. If referred by an affiliate, attribute commission automatically
    if (status === "active" && referrerCode) {
      await attributeSubscriptionConversion({
        referrerCode,
        newTenantSlug: tenantSlug,
        planTier,
        amountPaid,
      }).catch(() => {});
    }

    return NextResponse.json({
      received: true,
      success: updateResult.success,
      limits: updateResult.limits,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ أثناء معالجة الويب هوك";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
