import { getAdmin } from "@/lib/admin/guard";
import { listRecentAuditEvents } from "@/lib/db/admin-audit";
import { getDb } from "@/lib/db/client";

const headers = { "Cache-Control": "private, no-store" };

export async function GET() {
  if (!(await getAdmin())) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers });
  }
  try {
    return Response.json({ events: await listRecentAuditEvents(getDb()) }, { headers });
  } catch {
    return Response.json({ error: "audit_unavailable" }, { status: 503, headers });
  }
}
