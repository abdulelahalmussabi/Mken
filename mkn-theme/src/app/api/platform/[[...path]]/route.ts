import { createRequire } from "node:module";
import { NextResponse } from "next/server";

const require = createRequire(import.meta.url);
const { handlePlatform } = require("../../../../server/platform/invoke.cjs");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ path?: string[] }> };

async function handle(request: Request, context: Context) {
  try {
    const { path } = await context.params;
    return await handlePlatform(request, path || []);
  } catch (error) {
    console.error("platform route:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
