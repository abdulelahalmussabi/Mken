import { NextResponse } from "next/server";
import { gatedTenantScope } from "@/lib/mken/saas-guard";
import {
  getZatcaStatus,
  hasZatcaEncryptionKey,
  invoiceToZatcaReportInput,
  onboardZatca,
  persistInvoiceZatcaMeta,
  reportInvoiceToZatca,
  type ZatcaOnboardInput,
} from "@/lib/mken/zatca";
import type { Invoice } from "@/lib/mken/invoices";

export async function GET(request: Request) {
  const scope = await gatedTenantScope(request, "invoices");
  if (!scope.slug) {
    return NextResponse.json(
      { success: false, error: scope.message },
      { status: scope.status || 400 }
    );
  }

  const { status, error } = await getZatcaStatus(scope.slug);
  if (error) {
    return NextResponse.json({ success: false, error }, { status: 500 });
  }

  return NextResponse.json({ success: true, ...status });
}

export async function POST(request: Request) {
  const scope = await gatedTenantScope(request, "invoices");
  if (!scope.slug) {
    return NextResponse.json(
      { success: false, error: scope.message },
      { status: scope.status || 400 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "طلب غير صالح" }, { status: 400 });
  }

  const action = typeof body.action === "string" ? body.action : "";
  if (!action) {
    return NextResponse.json({ success: false, error: "Missing action parameter" }, { status: 400 });
  }

  if ((action === "onboard" || action === "report") && !hasZatcaEncryptionKey()) {
    return NextResponse.json(
      { success: false, error: "ZATCA_ENCRYPTION_KEY is not configured" },
      { status: 503 }
    );
  }

  if (action === "onboard") {
    const input: ZatcaOnboardInput = {
      vatNumber: String(body.vatNumber || "").trim(),
      otp: String(body.otp || "").trim(),
      businessName: typeof body.businessName === "string" ? body.businessName.trim() : undefined,
      environment: typeof body.environment === "string" ? body.environment : "sandbox",
      businessCategory:
        typeof body.businessCategory === "string" ? body.businessCategory.trim() : undefined,
      street: typeof body.street === "string" ? body.street.trim() : undefined,
      city: typeof body.city === "string" ? body.city.trim() : undefined,
      buildingNo: typeof body.buildingNo === "string" ? body.buildingNo.trim() : undefined,
      district: typeof body.district === "string" ? body.district.trim() : undefined,
    };

    if (!input.vatNumber || !input.otp) {
      return NextResponse.json(
        { success: false, error: "Required fields missing: vatNumber, otp" },
        { status: 400 }
      );
    }

    const { config, logs, error } = await onboardZatca(scope.slug, input);
    if (error) {
      return NextResponse.json({ success: false, error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "ZATCA Onboarding completed successfully",
      config,
      logs,
    });
  }

  if (action === "report") {
    const invoice = body.invoice as Invoice | undefined;
    if (!invoice?.id) {
      return NextResponse.json(
        { success: false, error: "Missing invoice or tenantSlug" },
        { status: 400 }
      );
    }

    const { result, failed, error } = await reportInvoiceToZatca(
      scope.slug,
      invoiceToZatcaReportInput(invoice)
    );

    if (failed) {
      await persistInvoiceZatcaMeta(scope.slug, invoice.id, {
        zatcaStatus: failed.zatcaStatus,
        zatcaUuid: failed.zatcaUuid,
        zatcaXmlHash: failed.zatcaXmlHash,
        zatcaQrCode: failed.zatcaQrCode,
      });
      return NextResponse.json(
        {
          success: false,
          zatcaStatus: failed.zatcaStatus,
          zatcaUuid: failed.zatcaUuid,
          zatcaXmlHash: failed.zatcaXmlHash,
          zatcaQrCode: failed.zatcaQrCode,
          response: failed.response,
        },
        { status: 400 }
      );
    }

    if (error || !result) {
      const status = error?.includes("not configured") ? 400 : error?.includes("not found") ? 404 : 500;
      return NextResponse.json({ success: false, error: error || "تعذّر الإبلاغ" }, { status });
    }

    const persist = await persistInvoiceZatcaMeta(scope.slug, invoice.id, {
      zatcaStatus: result.zatcaStatus,
      zatcaUuid: result.zatcaUuid,
      zatcaXmlHash: result.zatcaXmlHash,
      zatcaQrCode: result.zatcaQrCode,
    });

    if (!persist.ok) {
      return NextResponse.json(
        {
          success: false,
          error: persist.error,
          zatcaStatus: result.zatcaStatus,
          zatcaUuid: result.zatcaUuid,
          zatcaXmlHash: result.zatcaXmlHash,
          zatcaQrCode: result.zatcaQrCode,
          response: result.response,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      zatcaStatus: result.zatcaStatus,
      zatcaUuid: result.zatcaUuid,
      zatcaXmlHash: result.zatcaXmlHash,
      zatcaQrCode: result.zatcaQrCode,
      response: result.response,
    });
  }

  return NextResponse.json({ success: false, error: "Unsupported action" }, { status: 400 });
}
