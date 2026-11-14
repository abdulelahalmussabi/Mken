import { NextResponse } from "next/server";
import { handleWhatsappInbound, whatsappVerifyResponse } from "@/lib/mken/whatsapp-inbound";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  return whatsappVerifyResponse(request);
}

export async function POST(request: Request) {
  try {
    return await handleWhatsappInbound(request);
  } catch (error) {
    console.error("whatsapp-webhook:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : "unknown" },
      { status: 500 }
    );
  }
}
