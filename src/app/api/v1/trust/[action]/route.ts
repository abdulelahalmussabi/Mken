import { NextResponse } from "next/server";
import {
  proxyTrustAction,
  resolveTrustAction,
  trustOptionsResponse,
  withTrustCors,
} from "@/lib/mken/trust-bff";

type RouteContext = { params: Promise<{ action: string }> };

export async function OPTIONS(request: Request) {
  return trustOptionsResponse(request);
}

export async function POST(request: Request, context: RouteContext) {
  const { action: rawAction } = await context.params;
  const action = resolveTrustAction(rawAction);

  if (!action) {
    return withTrustCors(
      NextResponse.json(
        {
          error: "unknown_action",
          hint: "Use /api/v1/trust/challenge|verify|fallback",
        },
        { status: 400 }
      ),
      request
    );
  }

  try {
    return await proxyTrustAction(request, action);
  } catch (err) {
    console.error("trust_bff_handler", err instanceof Error ? err.message : err);
    return withTrustCors(NextResponse.json({ error: "internal_error" }, { status: 500 }), request);
  }
}
