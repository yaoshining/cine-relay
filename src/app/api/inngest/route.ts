import { serve } from "inngest/next";
import { NextRequest } from "next/server";
import { backfillRun, inngest, localInngestDemo, sampleRun, scanSyncSchedules, schedulerEnabled, tvPrefetchEnabled, tvPrefetch, validateMovieSelection } from "@/lib/sync/inngest";

export const runtime = "nodejs";
export const maxDuration = 60;

const handlers = serve({ client: inngest, functions: localInngestDemo ? [validateMovieSelection] : [sampleRun, backfillRun, ...(tvPrefetchEnabled ? [tvPrefetch] : []), ...(schedulerEnabled ? [scanSyncSchedules] : [])] });
const maxPayload = 128 * 1024;
const headers = { "Cache-Control": "no-store" };

async function dispatch(request: NextRequest, method: "GET" | "POST" | "PUT") {
  if (!localInngestDemo && !process.env.INNGEST_SIGNING_KEY?.trim()) {
    return Response.json({ error: "ingress_not_configured" }, { status: 503, headers });
  }

  if (!localInngestDemo && method === "POST" && !request.headers.has("x-inngest-signature")) {
    return Response.json({ error: "signature_required" }, { status: 401, headers });
  }
  if (request.body) {
    // Bound the input even when the sender omits Content-Length.
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > maxPayload) {
          void reader.cancel().catch(() => {});
          return Response.json({ error: "payload_too_large" }, { status: 413, headers });
        }
        chunks.push(value);
      }
    } catch {
      return Response.json({ error: "invalid_body" }, { status: 400, headers });
    } finally {
      reader.releaseLock();
    }
    const body = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    request = new NextRequest(request.url, { method, headers: request.headers, body });
  }
  const response = await handlers[method](request, undefined);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export function GET(request: NextRequest) { return dispatch(request, "GET"); }
export function POST(request: NextRequest) { return dispatch(request, "POST"); }
export function PUT(request: NextRequest) { return dispatch(request, "PUT"); }
