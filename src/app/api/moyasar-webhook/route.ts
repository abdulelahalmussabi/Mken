import { NextResponse } from "next/server";
import { getTenantDb, TENANT_TABLE } from "@/lib/mken/tenant";
import { issuePaidLiteLicense } from "@/lib/mken/licenses";
import { sendOutboundWhatsapp } from "@/lib/mken/whatsapp";

export const dynamic = "force-dynamic";

type MoyasarPayment = {
  id?: string;
  status?: string;
  amount?: number;
  metadata?: Record<string, unknown>;
  source?: { company?: string; type?: string };
};

async function fetchMoyasarPayment(paymentId: string): Promise<{ payment?: MoyasarPayment; error?: string }> {
  const secret = process.env.MOYASAR_SECRET_KEY;
  if (!secret) return { error: "Server configuration error: payment verification key missing" };
  const auth = Buffer.from(`${secret}:`).toString("base64");
  const response = await fetch(`https://api.moyasar.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!response.ok) return { error: `Moyasar verification failed with HTTP status ${response.status}` };
  return { payment: (await response.json()) as MoyasarPayment };
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export async function POST(request: Request) {
  let body: MoyasarPayment = {};
  try {
    body = (await request.json()) as MoyasarPayment;
  } catch {
    return NextResponse.json({ error: "Missing payment ID in request body" }, { status: 400 });
  }

  const paymentId = body.id;
  if (!paymentId) return NextResponse.json({ error: "Missing payment ID in request body" }, { status: 400 });

  const verified = await fetchMoyasarPayment(paymentId);
  if (verified.error || !verified.payment) {
    return NextResponse.json({ error: `Failed to verify payment with provider API: ${verified.error}` }, { status: 400 });
  }

  const payment = verified.payment;
  if (payment.status !== "paid" && payment.status !== "captured") {
    return NextResponse.json({ status: "ignored", reason: `Payment status is ${payment.status || "unknown"}` });
  }

  const db = getTenantDb();
  if (!db) return NextResponse.json({ error: "Server configuration error" }, { status: 500 });

  const metadata = payment.metadata || {};
  const paymentMethod = payment.source?.company || payment.source?.type || "online";
  const paymentAmount = (payment.amount || 0) / 100;
  const type = str(metadata.type) || (metadata.appointment_id ? "booking" : metadata.order_id ? "order" : "unknown");
  const slug = str(metadata.tenant_slug) || "default";

  try {
    if (type === "mken_lite_license") {
      const result = await issuePaidLiteLicense({
        paymentId,
        amountHalalah: payment.amount || 0,
        metadata,
      });
      return NextResponse.json(result.body, { status: result.status });
    }

    if (type === "booking") {
      const appointmentId = str(metadata.appointment_id);
      if (!appointmentId) return NextResponse.json({ error: "Missing appointment_id in payment metadata" }, { status: 400 });
      const { data: apt, error } = await db
        .from("mken_appointments")
        .select("payment_amount, payment_status, payment_id")
        .eq("id", appointmentId)
        .maybeSingle();
      if (error) throw error;
      if (!apt) return NextResponse.json({ error: "Appointment not found in database" }, { status: 400 });
      if (apt.payment_status === "paid" && apt.payment_id === paymentId) {
        return NextResponse.json({ success: true, message: "Already processed", type: "booking", id: appointmentId });
      }
      if (Math.abs(paymentAmount - Number(apt.payment_amount)) > 0.01) {
        return NextResponse.json({ error: "Payment amount mismatch" }, { status: 400 });
      }
      const { data, error: updErr } = await db
        .from("mken_appointments")
        .update({
          payment_status: "paid",
          payment_id: paymentId,
          payment_method: paymentMethod,
          payment_amount: paymentAmount,
          status: "confirmed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", appointmentId)
        .select();
      if (updErr) throw updErr;
      const row = data?.[0] as { phone?: string } | undefined;
      if (row?.phone) {
        await sendOutboundWhatsapp(slug, row.phone, "تم تأكيد حجزك بعد الدفع بنجاح.", "confirmation", { maxBody: 4000 });
      }
      return NextResponse.json({ success: true, type: "booking", id: appointmentId });
    }

    if (type === "order") {
      const orderId = str(metadata.order_id);
      if (!orderId) return NextResponse.json({ error: "Missing order_id in payment metadata" }, { status: 400 });
      const { data: ord, error } = await db
        .from("mken_orders")
        .select("payment_amount, payment_status, payment_id")
        .eq("id", orderId)
        .maybeSingle();
      if (error) throw error;
      if (!ord) return NextResponse.json({ error: "Order not found in database" }, { status: 400 });
      if (ord.payment_status === "paid" && ord.payment_id === paymentId) {
        return NextResponse.json({ success: true, message: "Already processed", type: "order", id: orderId });
      }
      if (Math.abs(paymentAmount - Number(ord.payment_amount)) > 0.01) {
        return NextResponse.json({ error: "Payment amount mismatch" }, { status: 400 });
      }
      const { data, error: updErr } = await db
        .from("mken_orders")
        .update({
          payment_status: "paid",
          payment_id: paymentId,
          payment_method: paymentMethod,
          payment_amount: paymentAmount,
          status: "confirmed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId)
        .select();
      if (updErr) throw updErr;
      const row = data?.[0] as { phone?: string } | undefined;
      if (row?.phone) {
        await sendOutboundWhatsapp(slug, row.phone, "تم تأكيد طلبك بعد الدفع بنجاح.", "order_confirmation", { maxBody: 4000 });
      }
      return NextResponse.json({ success: true, type: "order", id: orderId });
    }

    if (type === "saas_billing") {
      const renewMonths = parseInt(str(metadata.months), 10) || 12;
      const { data: existingInvoice } = await db.from("mken_saas_invoices").select("id").eq("payment_id", paymentId).maybeSingle();
      if (existingInvoice) {
        return NextResponse.json({ success: true, message: "Already processed", type: "saas_billing", tenant: slug });
      }
      const expected = renewMonths === 1 ? 99 : renewMonths === 3 ? 249 : renewMonths === 6 ? 449 : 799;
      if (Math.abs(paymentAmount - expected) > 0.01) {
        return NextResponse.json({ error: "Payment amount mismatch for SaaS subscription" }, { status: 400 });
      }
      const { data: tenant, error: fetchErr } = await db.from(TENANT_TABLE).select("*").eq("tenant_slug", slug).maybeSingle();
      if (fetchErr) throw fetchErr;
      if (!tenant) return NextResponse.json({ error: `Tenant ${slug} not found` }, { status: 400 });

      let currentEnd = new Date(tenant.subscription_end);
      if (Number.isNaN(currentEnd.getTime()) || currentEnd < new Date()) currentEnd = new Date();
      currentEnd.setMonth(currentEnd.getMonth() + renewMonths);

      const updateFields: Record<string, unknown> = {
        subscription_status: "active",
        subscription_end: currentEnd.toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (tenant.saved_config_data) {
        updateFields.config_data = tenant.saved_config_data;
        updateFields.saved_config_data = null;
      }
      const { error: updateErr } = await db.from(TENANT_TABLE).update(updateFields).eq("tenant_slug", slug);
      if (updateErr) throw updateErr;

      const invoiceId = `inv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      const { error: invoiceErr } = await db.from("mken_saas_invoices").insert({
        id: invoiceId,
        tenant_slug: slug,
        amount: paymentAmount,
        months: renewMonths,
        status: "paid",
        payment_id: paymentId,
        payment_method: paymentMethod,
      });
      if (invoiceErr) throw invoiceErr;

      if (tenant.phone) {
        await sendOutboundWhatsapp(
          slug,
          tenant.phone,
          `تم استلام دفعتك بنجاح لتجديد الاشتراك في منصة مكِّن! 🎉\nتم تجديد اشتراك نشاطك الموقر (${tenant.business_name || slug}) بنجاح لـ ${renewMonths} أشهر.\nتاريخ انتهاء الاشتراك الجديد: ${currentEnd.toLocaleDateString("ar-EG")}.\nشكراً لثقتك بنا!`,
          "subscription_reminder",
          { credentialsSlug: "default", maxBody: 4000 }
        );
      }
      return NextResponse.json({ success: true, type: "saas_billing", tenant: slug });
    }

    return NextResponse.json({ status: "ignored", reason: "Unrecognized metadata type or fields" });
  } catch (err) {
    return NextResponse.json(
      { error: `Internal Server Error: ${err instanceof Error ? err.message : "unknown"}` },
      { status: 500 }
    );
  }
}
