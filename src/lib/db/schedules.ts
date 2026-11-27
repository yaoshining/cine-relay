import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { changeId, type WriteDb } from "./sync-runs";

export async function enqueueDueTemplates(db: WriteDb, slot: string) {
  await db.execute(sql`with due as (
    select t.id,t.config,(c.cursor_state->>'generation')::uuid as generation
    from public.sync_job_templates t
    left join public.sync_cursors c on c.stream='changes:'||t.id::text and c.cursor_state->'scope'=((t.config->'selection')-'limit')
    where t.enabled and t.updated_at <= ${slot}::timestamptz + interval '1 hour'
      and (t.mode='backfill' or c.stream is not null)
      and (t.config #>> '{schedule,hour}') = (extract(hour from ${slot}::timestamptz at time zone 'Asia/Shanghai')::int)::text
      and ((t.config #>> '{schedule,kind}')='daily' or (
        (t.config #>> '{schedule,kind}')='weekly' and (t.config #>> '{schedule,weekday}') =
        (extract(isodow from ${slot}::timestamptz at time zone 'Asia/Shanghai')::int)::text))
      and not exists (select 1 from public.sync_job_runs r where r.template_id=t.id and r.scheduled_at=${slot}::timestamptz)
  ) insert into public.sync_job_runs (template_id,trigger_type,config_snapshot,scheduled_at,cursor_generation)
    select id,'scheduled',config,${slot}::timestamptz,generation from due
    on conflict (template_id,scheduled_at) do nothing`);
}

export async function listRecoverableDispatches(db: WriteDb) {
  const { rows } = await db.execute(sql`select id,trigger_type from public.sync_job_runs
    where status in ('queued','dispatch_failed') and created_at > now() - interval '24 hours'
      and (trigger_type = 'scheduled' or created_at < now() - interval '2 minutes')
    order by created_at,id limit 100`);
  return rows as { id: string; trigger_type: "scheduled" | "manual" | "sample" }[];
}

export function setScheduleEnabled(db: WriteDb, id: string, enabled: boolean, actor: string) {
  return changeId(db, sql`with changed as (
    update public.sync_job_templates t set enabled=${enabled}::boolean, updated_at=now()
    where id=${id}::uuid and enabled is distinct from ${enabled}::boolean
      and (not ${enabled}::boolean or ((t.config #>> '{schedule,kind}') in ('daily','weekly')
        and (t.mode='backfill' or exists (select 1 from public.sync_cursors c where c.stream='changes:'||t.id::text
          and c.cursor_state->'scope'=((t.config->'selection')-'limit')))))
    returning id
  ), audit as (
    insert into public.admin_audit_events(actor_github_id,action,target_type,target_id,outcome)
    select ${actor},${enabled ? "sync.schedule.enabled" : "sync.schedule.disabled"},'sync_template',id::text,'succeeded' from changed
  ) select id from changed`);
}

export function rebuildIncrementalCursor(db: WriteDb, id: string, actor: string) {
  return changeId(db, sql`with template as (
    update public.sync_job_templates set enabled=false, updated_at=now()
    where id=${id}::uuid and mode='incremental' and jsonb_typeof(config->'selection')='object' returning id,config
  ), reset as (
    insert into public.sync_cursors(stream,cursor_state)
    select 'changes:'||id::text,jsonb_build_object('scope',(config->'selection')-'limit',
      'generation',${randomUUID()}::text,'through',((now() at time zone 'UTC')::date - 1)::text) from template
    on conflict(stream) do update set cursor_state=excluded.cursor_state,updated_at=now()
  ), cleared as (
    delete from public.sync_incremental_pending where template_id in (select id from template)
  ), audit as (
    insert into public.admin_audit_events(actor_github_id,action,target_type,target_id,outcome)
    select ${actor},'sync.cursor.rebuilt','sync_template',id::text,'succeeded' from template
  ) select id from template`);
}

export async function cursorMatchesTemplate(db: WriteDb, id: string) {
  const { rows } = await db.execute(sql`select t.id from public.sync_job_templates t join public.sync_cursors c
    on c.stream='changes:'||t.id::text and c.cursor_state->'scope'=((t.config->'selection')-'limit')
    where t.id=${id}::uuid and t.mode='incremental' limit 1`);
  return rows.length > 0;
}
