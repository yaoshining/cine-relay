import { sql } from "drizzle-orm";
import type { WriteDb } from "./sync-runs";
import { backfillLimit } from "./backfill";

const scopedRun = (id: string) => sql`
  select r.id, r.template_id, r.config_snapshot->'selection' as selection, c.stream, c.cursor_state
  from public.sync_job_runs r join public.sync_job_templates t on t.id=r.template_id
  join public.sync_cursors c on c.stream='changes:'||t.id::text
    and c.cursor_state->>'generation'=r.cursor_generation::text
    and c.cursor_state->'scope'=((t.config->'selection')-'limit')
    and c.cursor_state->'scope'=((r.config_snapshot->'selection')-'limit')
  where r.id=${id}::uuid and r.status='running' and t.mode='incremental'`;

export async function changeWindow(db: WriteDb, id: string) {
  const { rows } = await db.execute(sql`
    select (cursor_state->>'through')::date::text as previous,
      least((cursor_state->>'through')::date+13,(now() at time zone 'UTC')::date-1)::text as "through"
    from (${scopedRun(id)}) valid`);
  return (rows[0] as { previous: string; through: string } | undefined) ?? null;
}

export async function commitChangeWindow(db: WriteDb, id: string, previous: string, through: string, ids: number[]) {
  await db.execute(sql`
    with allowed as (
      ${scopedRun(id)} for update of t
    ), advanced as (
      update public.sync_cursors c set cursor_state=c.cursor_state||jsonb_build_object('through',${through}::text),updated_at=now()
      from allowed a where c.stream=a.stream and c.cursor_state=a.cursor_state and c.cursor_state->>'through'=${previous}
        and ${through}::date > ${previous}::date
      returning a.template_id,a.selection
    )
    insert into public.sync_incremental_pending(template_id,tmdb_id)
      select a.template_id,m.tmdb_id from advanced a
      join (select distinct jsonb_array_elements_text(${JSON.stringify(ids)}::jsonb)::bigint as tmdb_id) candidate on true
      join public.movies m using (tmdb_id)
      where m.removed_at is null and m.release_date between (a.selection->>'releaseFrom')::date and (a.selection->>'releaseThrough')::date
        and (a.selection->>'originalLanguage' is null or m.original_language=a.selection->>'originalLanguage')
        and (jsonb_array_length(a.selection->'genreIds')=0 or m.genre_ids && array(select jsonb_array_elements_text(a.selection->'genreIds')::integer))
      on conflict (template_id,tmdb_id) do nothing`);
}

export async function claimIncrementalPlan(db: WriteDb, id: string, limit: number) {
  const { rows } = await db.execute(sql`
    with allowed as (${scopedRun(id)} for update of t), marked as (
      update public.sync_job_runs r set result_summary=jsonb_build_object('kind','backfill','pageLimitReached',false)
      where r.id in (select id from allowed) and not coalesce(r.result_summary ? 'pageLimitReached',false)
      returning r.id,r.template_id
    ), chosen as (
      select q.template_id,q.tmdb_id,q.queued_at from public.sync_incremental_pending q
      join marked m on m.template_id=q.template_id order by q.queued_at,q.tmdb_id limit ${Math.min(limit,backfillLimit)}
    ), dequeued as (
      delete from public.sync_incremental_pending q using chosen p where q.template_id=p.template_id and q.tmdb_id=p.tmdb_id returning q.*
    ), items as (
      insert into public.sync_run_items(run_id,tmdb_id,position)
      select m.id,q.tmdb_id,row_number() over(order by q.queued_at,q.tmdb_id)
      from dequeued q join marked m on m.template_id=q.template_id
    )
    select id from allowed`);
  return rows.length > 0;
}
