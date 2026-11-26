import { desc, eq, sql, type SQL } from "drizzle-orm";
import type { Database } from "./client";
import { syncJobRuns, syncJobTemplates } from "./schema";
import type { SyncConfig } from "@/lib/sync/config";
import type { SampleOutcome } from "@/lib/sync/sample";

export type ReadDb = Pick<Database, "select">;
export type WriteDb = { execute(query: SQL): PromiseLike<{ rows: Record<string, unknown>[] }> };

export const syncListLimit = 50;

export async function listTemplates(db: ReadDb) {
  return db.select().from(syncJobTemplates)
    .orderBy(desc(syncJobTemplates.updatedAt), desc(syncJobTemplates.id)).limit(syncListLimit);
}

export async function findTemplate(db: ReadDb, id: string) {
  return (await db.select().from(syncJobTemplates).where(eq(syncJobTemplates.id, id)).limit(1))[0] ?? null;
}

export async function listRuns(db: ReadDb) {
  return db.select({
    id: syncJobRuns.id, status: syncJobRuns.status, triggerType: syncJobRuns.triggerType, createdAt: syncJobRuns.createdAt,
    name: sql<string | null>`${syncJobRuns.configSnapshot}->>'name'`,
  }).from(syncJobRuns).orderBy(desc(syncJobRuns.createdAt), desc(syncJobRuns.id)).limit(syncListLimit);
}

export async function findRun(db: ReadDb, id: string) {
  return (await db.select().from(syncJobRuns).where(eq(syncJobRuns.id, id)).limit(1))[0] ?? null;
}

export async function changeId(db: WriteDb, query: SQL) {
  const id = (await db.execute(query)).rows[0]?.id;
  return typeof id === "string" ? id : null;
}

export function saveTemplate(db: WriteDb, config: SyncConfig, actor: string, id?: string) {
  const configJson = JSON.stringify(config);
  const change = id ? sql`
    update public.sync_job_templates set name = ${config.name}, mode = ${config.mode}, config = ${configJson}::jsonb, updated_at = now(),
      enabled = enabled and mode = ${config.mode} and coalesce(((config->'selection')-'limit') = (((${configJson}::jsonb)->'selection')-'limit'), false)
        and coalesce(config->'schedule' = (${configJson}::jsonb)->'schedule', false)
    where id = ${id}::uuid returning id` : sql`
    insert into public.sync_job_templates (name,mode,config) values (${config.name},${config.mode},${configJson}::jsonb) returning id`;
  return changeId(db, sql`
    with changed as (${change}), invalidated as (
      delete from public.sync_cursors c using changed
      where c.stream='changes:'||changed.id::text
        and (${config.mode} <> 'incremental' or c.cursor_state->'scope' is distinct from ((${configJson}::jsonb)->'selection')-'limit')
    ), audit as (
      insert into public.admin_audit_events (actor_github_id, action, target_type, target_id, outcome)
      select ${actor}, ${id ? "sync.template.updated" : "sync.template.created"}, 'sync_template', id::text, 'succeeded' from changed
    ) select id from changed`);
}

export function createSampleRun(db: WriteDb, config: SyncConfig, actor: string, templateId?: string) {
  return changeId(db, sql`
    with changed as (
      insert into public.sync_job_runs (template_id, trigger_type, config_snapshot)
      values (${templateId ?? null}::uuid, 'sample', ${JSON.stringify(config)}::jsonb) returning id
    ), audit as (
      insert into public.admin_audit_events (actor_github_id, action, target_type, target_id, outcome)
      select ${actor}, 'sync.sample.requested', 'sync_run', id::text, 'succeeded' from changed
    ) select id from changed`);
}

export function queueSyncDispatchRetry(db: WriteDb, id: string, actor: string, type: "sample" | "manual" | "scheduled" = "sample") {
  return changeId(db, sql`
    with changed as (
      update public.sync_job_runs set status = 'queued'
      where id = ${id}::uuid and trigger_type = ${type} and status = 'dispatch_failed' returning id
    ), audit as (
      insert into public.admin_audit_events (actor_github_id, action, target_type, target_id, outcome)
      select ${actor}, ${type === "sample" ? "sync.sample.redispatched" : "sync.backfill.redispatched"}, 'sync_run', id::text, 'succeeded' from changed
    ) select id from changed`);
}

export async function noteSyncDispatchFailure(db: WriteDb, id: string, type: "sample" | "manual" | "scheduled" = "sample") {
  await db.execute(sql`update public.sync_job_runs set status = 'dispatch_failed'
    where id = ${id}::uuid and trigger_type = ${type} and status = 'queued'`);
}

// The same Inngest run can replay this step if the transaction succeeded but
// the step result was not recorded yet. Inngest serializes execution by run ID.
export async function startSampleRun(db: WriteDb, id: string) {
  const { rows } = await db.execute(sql`update public.sync_job_runs set status = 'running', started_at = coalesce(started_at, now())
    where id = ${id}::uuid and trigger_type = 'sample' and status in ('queued', 'dispatch_failed', 'running')
    returning config_snapshot`);
  return rows[0]?.config_snapshot ?? null;
}

export async function finishSampleRun(db: WriteDb, id: string, outcome: SampleOutcome) {
  await db.execute(sql`update public.sync_job_runs
    set status = ${outcome.status}, result_summary = ${JSON.stringify(outcome.summary)}::jsonb, finished_at = now()
    where id = ${id}::uuid and trigger_type = 'sample' and status in ('queued', 'dispatch_failed', 'running')`);
}

export type SyncTemplate = NonNullable<Awaited<ReturnType<typeof findTemplate>>>;
export type SyncRun = NonNullable<Awaited<ReturnType<typeof findRun>>>;
