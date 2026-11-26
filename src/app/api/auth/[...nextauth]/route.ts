import type { NextRequest } from "next/server";
import { adminAuth, githubLoginConfigured } from "@/lib/admin/auth";

function unavailable() {
  return Response.json({ error: "auth_not_configured" }, {
    status: 503, headers: { "Cache-Control": "no-store" },
  });
}

export function GET(request: NextRequest) {
  return githubLoginConfigured() ? adminAuth.handlers.GET(request) : unavailable();
}

export function POST(request: NextRequest) {
  return githubLoginConfigured() ? adminAuth.handlers.POST(request) : unavailable();
}
