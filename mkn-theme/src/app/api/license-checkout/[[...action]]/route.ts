import { NextResponse } from "next/server";
import { licenseCheckoutConfig, licenseCheckoutStatus } from "@/lib/mken/licenses";

export const dynamic = "force-dynamic";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function actionOf(request: Request, parts?: string[]): string {
  if (parts?.[0]) return parts[0];
  return new URL(request.url).searchParams.get("action") || "";
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(request: Request, context: { params: Promise<{ action?: string[] }> }) {
  const params = await context.params;
  const action = actionOf(request, params.action);
  const url = new URL(request.url);

  if (action === "config") {
    return NextResponse.json(licenseCheckoutConfig(), { headers: CORS });
  }

  if (action === "status") {
    const result = await licenseCheckoutStatus(url.searchParams.get("paymentId") || url.searchParams.get("payment_id") || "");
    return NextResponse.json(result.body, { status: result.status, headers: CORS });
  }

  return NextResponse.json({ error: "استخدم /api/license-checkout/config أو /status" }, { status: 400, headers: CORS });
}
