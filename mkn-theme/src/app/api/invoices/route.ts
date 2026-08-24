import { NextResponse } from "next/server";
import { gatedTenantScope } from "@/lib/mken/saas-guard";
import { fetchInvoices, summarize } from "@/lib/mken/invoices";

export async function GET(request: Request) {
  const scope = await gatedTenantScope(request, "invoices");
  if (!scope.slug) {
    return NextResponse.json(
      { success: false, message: scope.message },
      { status: scope.status || 400 }
    );
  }

  const limit = Number(new URL(request.url).searchParams.get("limit")) || 300;
  const { invoices, error, tableMissing } = await fetchInvoices(scope.slug, limit);
  if (error || !invoices) {
    return NextResponse.json({ success: false, message: error }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    tenant: scope.slug,
    tableMissing: tableMissing || false,
    totals: summarize(invoices),
    invoices,
  });
}
