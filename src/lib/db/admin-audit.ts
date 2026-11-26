import { desc } from "drizzle-orm";
import type { OAuthAdmission } from "../admin/identity";
import type { Database } from "./client";
import { adminAuditEvents } from "./schema";

export const recentAuditLimit = 100;

type AuditWriter = {
  insert(table: typeof adminAuditEvents): { values(row: typeof adminAuditEvents.$inferInsert): PromiseLike<unknown> };
};

export async function writeOAuthAdmission(db: AuditWriter, event: OAuthAdmission) {
  await db.insert(adminAuditEvents).values({
    actorGithubId: event.githubId,
    action: "admin.oauth.admission",
    targetType: "admin_access",
    outcome: event.allowed ? "succeeded" : "denied",
  });
}

export function listRecentAuditEvents(db: Pick<Database, "select">) {
  return db.select().from(adminAuditEvents)
    .orderBy(desc(adminAuditEvents.createdAt), desc(adminAuditEvents.id))
    .limit(recentAuditLimit);
}

export type AdminAuditEvent = Awaited<ReturnType<typeof listRecentAuditEvents>>[number];
