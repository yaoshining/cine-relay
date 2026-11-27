import { asc, eq, sql } from "drizzle-orm";
import { syncJobRuns, syncRunItems } from "./schema";
import { changeId, type ReadDb, type WriteDb } from "./sync-runs";
import type { TmdbMovieClient } from "@/lib/tmdb/movie-client";

export type FetchedMovie = Awaited<ReturnType<TmdbMovieClient["detail"]>>;
export const backfillLimit = 10;

export async function backfillItems(db: ReadDb, id: string) {
  return db.select().from(syncRunItems).where(eq(syncRunItems.runId, id)).orderBy(asc(syncRunItems.position));
}
export type BackfillItem = Awaited<ReturnType<typeof backfillItems>>[number];

export async function findBackfillRetry(db: ReadDb, id: string) {
  const [run] = await db.select({ id: syncJobRuns.id }).from(syncJobRuns).where(eq(syncJobRuns.retryOf, id));
  return run?.id ?? null;
}

export function createBackfill(db: WriteDb, templateId: string, actor: string) {
  return changeId(db, sql`
    with created as (
      insert into public.sync_job_runs (template_id, trigger_type, config_snapshot, cursor_generation)
      select t.id, 'manual', t.config,(c.cursor_state->>'generation')::uuid
      from public.sync_job_templates t left join public.sync_cursors c
        on c.stream='changes:'||t.id::text and c.cursor_state->'scope'=((t.config->'selection')-'limit')
      where t.id = ${templateId}::uuid and t.mode=t.config->>'mode' and (t.mode='backfill' or c.stream is not null) returning id
    ), audit as (
      insert into public.admin_audit_events (actor_github_id, action, target_type, target_id, outcome)
      select ${actor}, 'sync.backfill.requested', 'sync_run', id::text, 'succeeded' from created
    ) select id from created`);
}

export function createBackfillRetry(db: WriteDb, id: string, actor: string) {
  return changeId(db, sql`
    with created as (
      insert into public.sync_job_runs (template_id, trigger_type, config_snapshot, result_summary, retry_of, cursor_generation)
      select template_id, 'manual', config_snapshot,
        case when result_summary ? 'pageLimitReached' then jsonb_build_object('kind','backfill','pageLimitReached',result_summary->'pageLimitReached') end, id,cursor_generation
      from public.sync_job_runs where id = ${id}::uuid and trigger_type <> 'sample' and config_snapshot->>'mode' in ('backfill','incremental')
        and status in ('failed', 'partial_failed') and coalesce((result_summary->>'retryAt')::timestamptz, now()) <= now()
      on conflict (retry_of) do nothing returning id, retry_of
    ), copied as (
      insert into public.sync_run_items (run_id,tmdb_id,position)
      select created.id, i.tmdb_id, i.position from public.sync_run_items i join created on created.retry_of = i.run_id
      where i.status in ('pending','fetched','failed','deferred')
    ), audit as (
      insert into public.admin_audit_events (actor_github_id, action, target_type, target_id, outcome)
      select ${actor}, 'sync.backfill.retried', 'sync_run', id::text, 'succeeded' from created
    ) select id from created`);
}

export async function startBackfill(db: WriteDb, id: string) {
  const { rows } = await db.execute(sql`
    update public.sync_job_runs set status = 'running', started_at = coalesce(started_at,now())
    where id = ${id}::uuid and trigger_type <> 'sample' and status in ('queued','dispatch_failed','running')
    returning config_snapshot, coalesce(result_summary ? 'pageLimitReached',false) as planned`);
  return rows[0] ?? null;
}

export async function fixBackfillPlan(db: WriteDb, id: string, ids: number[], pageLimitReached: boolean) {
  const plannedIds = [...new Set(ids)].slice(0, backfillLimit);
  await db.execute(sql`
    with changed as (
      update public.sync_job_runs set result_summary = jsonb_build_object('kind','backfill','pageLimitReached',${pageLimitReached}::boolean)
      where id = ${id}::uuid and trigger_type <> 'sample' and status = 'running' and not coalesce(result_summary ? 'pageLimitReached',false)
      returning id
    ) insert into public.sync_run_items (run_id,tmdb_id,position)
      select changed.id, candidate.value::bigint, candidate.ordinality
      from changed cross join lateral jsonb_array_elements_text(${JSON.stringify(plannedIds)}::jsonb) with ordinality as candidate(value,ordinality)`);
}

export async function markFetched(db: WriteDb, runId: string, snapshot: FetchedMovie) {
  await db.execute(sql`update public.sync_run_items set status = 'fetched', fetched_at = ${snapshot.fetchedAt}::timestamptz
    where run_id = ${runId}::uuid and tmdb_id = ${snapshot.tmdbId}::bigint and status = 'pending'`);
}

export async function noteFetchFailure(db: WriteDb, runId: string, tmdbId: number, code: string) {
  await db.execute(sql`update public.sync_run_items set status = 'failed', error_code = ${code}
    where run_id = ${runId}::uuid and tmdb_id = ${tmdbId}::bigint and status = 'pending'`);
}

// One Postgres statement is one transaction on the Neon HTTP driver. Lock the
// parent movie even when stale, so a concurrent tombstone or legacy import
// cannot slip between the shared metadata and localization writes.
export async function storeFetchedMovie(db: WriteDb, runId: string, movie: FetchedMovie) {
  const newer = sql`m.removed_at is null and excluded.updated_at > m.updated_at`;
  await db.execute(sql`
    with item as (
      select i.* from public.sync_run_items i join public.sync_job_runs r on r.id = i.run_id
      where i.run_id = ${runId}::uuid and i.tmdb_id = ${movie.tmdbId}::bigint and i.status = 'fetched'
        and i.fetched_at = ${movie.fetchedAt}::timestamptz and r.status = 'running'
        and r.config_snapshot #>> '{selection,locale}' = ${movie.locale}
      for update of i
    ), parent as (
      insert into public.movies as m (tmdb_id,original_title,release_date,genre_ids,updated_at,original_language,runtime_minutes)
      select tmdb_id, ${movie.originalTitle}, ${movie.releaseDate}::date,
        array(select jsonb_array_elements_text(${JSON.stringify(movie.genreIds)}::jsonb)::integer), fetched_at, ${movie.originalLanguage}, ${movie.runtimeMinutes}::integer
      from item
      on conflict (tmdb_id) do update set
        original_title = case when ${newer} then excluded.original_title else m.original_title end,
        release_date = case when ${newer} then excluded.release_date else m.release_date end,
        genre_ids = case when ${newer} then excluded.genre_ids else m.genre_ids end,
        updated_at = case when ${newer} then excluded.updated_at else m.updated_at end,
        original_language = case when ${newer} then excluded.original_language else m.original_language end,
        runtime_minutes = case when ${newer} then excluded.runtime_minutes else m.runtime_minutes end
      returning tmdb_id, removed_at
    ), localized as (
      insert into public.movie_localizations as l (tmdb_id,locale,title,overview,poster_path,fetched_at,expires_at,purge_after)
      select item.tmdb_id, ${movie.locale}, ${movie.title}, ${movie.overview}, ${movie.posterPath}, item.fetched_at,
        item.fetched_at + interval '168 hours', item.fetched_at + interval '720 hours'
      from item join parent using (tmdb_id) where parent.removed_at is null
      on conflict (tmdb_id,locale) do update set title = excluded.title, overview = excluded.overview, poster_path = excluded.poster_path,
        fetched_at = excluded.fetched_at, expires_at = excluded.expires_at, purge_after = excluded.purge_after
      where excluded.fetched_at > l.fetched_at returning tmdb_id
    ) update public.sync_run_items i
      set status = case when parent.removed_at is not null then 'removed'
                        when localized.tmdb_id is not null then 'stored' else 'unchanged' end
      from item join parent using (tmdb_id) left join localized using (tmdb_id)
      where i.run_id = item.run_id and i.tmdb_id = item.tmdb_id`);
}

export async function finishBackfill(db: WriteDb, id: string, code: string | null = null, retryAt: string | null = null) {
  const { rows } = await db.execute(sql`
    with deferred as (
      update public.sync_run_items i set status = 'deferred', error_code = ${code}::text
      where i.run_id = ${id}::uuid and i.status = 'pending' and ${code}::text in ('rate_limited','unauthorized','budget_unavailable')
        and exists (select 1 from public.sync_job_runs r where r.id = i.run_id and r.status = 'running')
    ), counts as (
      select count(*) filter (where status in ('stored','unchanged','removed')) as done,
             count(*) filter (where status in ('pending','fetched','failed','deferred')) as remaining
      from public.sync_run_items where run_id = ${id}::uuid
    ) update public.sync_job_runs
      set status = case when counts.remaining = 0 and ${code}::text is null then 'completed'
                        when counts.done > 0 then 'partial_failed' else 'failed' end,
          result_summary = coalesce(result_summary,'{}'::jsonb) || jsonb_build_object('kind','backfill','code',${code}::text,'retryAt',${retryAt}::text),
          finished_at = now()
      from counts where id = ${id}::uuid and trigger_type <> 'sample' and status in ('running','queued','dispatch_failed')
      returning status`);
  return rows[0]?.status as "completed" | "partial_failed" | "failed" | undefined;
}
