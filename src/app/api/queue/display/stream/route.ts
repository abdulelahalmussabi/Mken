import { getQueueState } from "@/lib/mken/queue";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tenantSlug = searchParams.get("tenant") || "default";

  // Check if client supports SSE
  const acceptHeader = request.headers.get("accept") || "";
  const isSSE = acceptHeader.includes("text/event-stream");

  if (!isSSE) {
    const state = await getQueueState(tenantSlug);
    return Response.json({ success: true, ...state });
  }

  const responseStream = new TransformStream();
  const writer = responseStream.writable.getWriter();
  const encoder = new TextEncoder();

  let isActive = true;

  const pushUpdate = async () => {
    if (!isActive) return;
    try {
      const state = await getQueueState(tenantSlug);
      const payload = `data: ${JSON.stringify(state)}\n\n`;
      await writer.write(encoder.encode(payload));
    } catch {
      isActive = false;
    }
  };

  // Push immediate initial state
  pushUpdate();

  // Push every 3 seconds for live TV signage freshness
  const interval = setInterval(pushUpdate, 3000);

  request.signal.addEventListener("abort", () => {
    isActive = false;
    clearInterval(interval);
    writer.close().catch(() => {});
  });

  return new Response(responseStream.readable, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
