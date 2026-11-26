import { AuditLog } from "@/components/audit-log";
import { requireAdmin } from "@/lib/admin/guard";
import { listRecentAuditEvents } from "@/lib/db/admin-audit";
import { getDb } from "@/lib/db/client";

async function readSnapshot() {
  const asOf = Date.now();
  try {
    return { asOf, events: await listRecentAuditEvents(getDb()) };
  } catch {
    return { asOf, events: null };
  }
}

export default async function Audit() {
  await requireAdmin();
  return <AuditLog {...await readSnapshot()}/>;
}
