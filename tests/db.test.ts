import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test, { type TestContext } from "node:test"
import { PGlite } from "@electric-sql/pglite"
import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/pglite"
import { importQueries } from "../scripts/tmdb_import.mjs"
import { findMovieCache } from "../src/lib/db/movie-cache"
import * as schema from "../src/lib/db/schema"

const initial = readFileSync(new URL("../db/migrations/0001_initial.sql", import.meta.url), "utf8")
const incremental = readFileSync(new URL("../db/migrations/0002_mvp_data_layer.sql", import.meta.url), "utf8")
const fetchedAt = "2026-02-01T01:02:03.123456Z"
const snapshot = {
  tmdb_id: 101, locale: "zh-CN", title: "合成片名", original_title: "Synthetic title",
  overview: null, poster_path: null, release_date: "2026-01-01", genre_ids: [12, 18], fetched_at: fetchedAt,
}

async function setup(t: TestContext) {
  const pg = new PGlite()
  t.after(() => pg.close())
  // PostgreSQL renders timestamptz in its session zone, not necessarily UTC.
  await pg.exec("SET TIME ZONE 'UTC'")
  return { pg, db: drizzle(pg, { schema }) }
}

async function migrate(pg: PGlite, ...sqlFiles: string[]) {
  await pg.transaction(async (tx) => {
    for (const ddl of sqlFiles) await tx.exec(ddl)
  })
}

function importSnapshot(pg: PGlite, row: typeof snapshot) {
  return pg.transaction(async (tx) => {
    const rows = []
    for (const { text, params } of importQueries([row])) rows.push((await tx.query(text, params)).rows[0])
    return rows
  })
}

function writeCount(written: number, removed = 0) {
  return [{ written }, { written, removed }]
}

async function legacyState(pg: PGlite) {
  const { rows } = await pg.query(`SELECT
    (SELECT jsonb_agg(to_jsonb(m) - 'original_language' - 'runtime_minutes' ORDER BY tmdb_id) FROM public.movies m) AS movies,
    (SELECT jsonb_agg(to_jsonb(l) ORDER BY tmdb_id, locale) FROM public.movie_localizations l) AS localizations,
    (SELECT jsonb_agg(to_jsonb(j) ORDER BY tmdb_id, locale) FROM public.movie_sync_jobs j) AS jobs,
    (SELECT jsonb_agg(to_jsonb(c) ORDER BY stream) FROM public.sync_cursors c) AS cursors`)
  return rows[0]
}

test("0001 → 0002 initializes an empty database and Drizzle reads precise IDs and times", async (t) => {
  const { pg, db } = await setup(t)
  await migrate(pg, initial, incremental)
  const tmdbId = 9007199254740993n
  assert.equal(await findMovieCache(db, tmdbId, "zh-CN"), null)

  await db.insert(schema.movies).values({
    tmdbId, originalLanguage: "ja", runtimeMinutes: 99, releaseDate: "2026-01-01",
  })
  await db.insert(schema.movieLocalizations).values({
    tmdbId, locale: "zh-CN", title: "合成片名", fetchedAt,
    expiresAt: "2026-02-08T01:02:03.123456Z", purgeAfter: "2026-03-03T01:02:03.123456Z",
  })
  const entry = await findMovieCache(db, tmdbId, "zh-CN")
  assert.equal(entry?.movie.tmdbId, tmdbId)
  assert.deepEqual(entry.movie.genreIds, [])
  assert.equal(entry.movie.originalLanguage, "ja")
  assert.equal(entry.movie.runtimeMinutes, 99)
  assert.equal(entry.movie.releaseDate, "2026-01-01")
  assert.equal(entry.localization.title, "合成片名")
  assert.equal(entry.localization.fetchedAt, "2026-02-01 01:02:03.123456+00")
  assert.equal(await findMovieCache(db, tmdbId, "en-US"), null)
  await assert.rejects(pg.query("UPDATE public.movies SET runtime_minutes = 0"), { code: "23514" })
  await assert.rejects(pg.query("UPDATE public.movies SET original_language = 'zh-CN'"), { code: "23514" })
})

test("0002 preserves populated legacy tables and the untouched importer can still write", async (t) => {
  const { pg, db } = await setup(t)
  await migrate(pg, initial)
  assert.deepEqual(await importSnapshot(pg, snapshot), writeCount(1))
  await pg.exec(`
    INSERT INTO public.movies (tmdb_id, removed_at) VALUES (102, '2026-02-02T00:00:00Z');
    INSERT INTO public.movie_localizations (tmdb_id, locale, title, fetched_at, expires_at, purge_after)
      SELECT tmdb_id, 'en-US', 'Synthetic English title', fetched_at, expires_at, purge_after
      FROM public.movie_localizations WHERE tmdb_id = 101;
    INSERT INTO public.sync_cursors (stream, cursor_state) VALUES ('synthetic', '{"page":2}');
    INSERT INTO public.movie_sync_jobs (tmdb_id, locale, status, attempts, lease_token, leased_until)
      VALUES (999, 'zh-CN', 'leased', 2, '00000000-0000-4000-8000-000000000001', '2026-03-01T00:00:00Z');
  `)
  const before = await legacyState(pg)
  await migrate(pg, incremental)
  assert.deepEqual(await legacyState(pg), before)
  const [job] = await db.select().from(schema.movieSyncJobs)
  const [cursor] = await db.select().from(schema.syncCursors)
  assert.equal(job.tmdbId, 999n)
  assert.equal(job.status, "leased")
  assert.deepEqual(cursor.cursorState, { page: 2 })
  const legacyMovie = await findMovieCache(db, 101n, "en-US")
  assert.equal(legacyMovie?.movie.originalLanguage, null)
  assert.equal(legacyMovie.movie.runtimeMinutes, null)

  assert.deepEqual(await importSnapshot(pg, snapshot), writeCount(0))
  assert.deepEqual(await legacyState(pg), before)
  const newer = { ...snapshot, title: "合成新标题", fetched_at: "2026-02-01T01:02:03.123457Z" }
  assert.deepEqual(await importSnapshot(pg, newer), writeCount(1))
  assert.deepEqual(await importSnapshot(pg, snapshot), writeCount(0))
  assert.deepEqual(await importSnapshot(pg, { ...newer, tmdb_id: 102 }), writeCount(0, 1))
  assert.deepEqual(await importSnapshot(pg, { ...newer, tmdb_id: 103 }), writeCount(1))
  const localization = (await findMovieCache(db, 101n, "zh-CN"))?.localization
  assert.equal(localization?.title, "合成新标题")
  assert.equal(localization.fetchedAt, "2026-02-01 01:02:03.123457+00")
  assert.equal(localization.expiresAt, "2026-02-08 01:02:03.123457+00")
  assert.equal(localization.purgeAfter, "2026-03-03 01:02:03.123457+00")
  assert.equal((await findMovieCache(db, 101n, "en-US"))?.localization.title, "Synthetic English title")
})

test("0002 stores run snapshots and enforces schedule deduplication and audit constraints", async (t) => {
  const { pg, db } = await setup(t)
  await migrate(pg, initial, incremental)
  const { syncJobTemplates, syncJobRuns, adminAuditEvents } = schema
  const config = { mode: "incremental", locale: "zh-CN" }
  const [template] = await db.insert(syncJobTemplates).values({ name: "合成任务", mode: "incremental", config }).returning()
  const [otherTemplate] = await db.insert(syncJobTemplates).values({ name: "另一任务", mode: "incremental", config }).returning()
  assert.equal(template.enabled, false)
  const [run] = await db.insert(syncJobRuns).values({
    templateId: template.id, triggerType: "scheduled", scheduledAt: fetchedAt, configSnapshot: config,
  }).returning()
  assert.equal(run.status, "queued")
  assert.equal(run.startedAt, null)
  await assert.rejects(pg.query(`INSERT INTO public.sync_job_runs (template_id, trigger_type, scheduled_at, config_snapshot)
    VALUES ($1, 'scheduled', $2, '{}')`, [template.id, "2026-02-01T09:02:03.123456+08:00"]), { code: "23505" })
  await assert.rejects(pg.query(`INSERT INTO public.sync_job_runs (template_id, trigger_type, config_snapshot)
    VALUES ($1, 'scheduled', '{}')`, [template.id]), { code: "23514" })
  await assert.rejects(pg.query(`INSERT INTO public.sync_job_runs (template_id, trigger_type, config_snapshot)
    VALUES ($1, 'manual', '[]')`, [template.id]), { code: "23514" })
  await assert.rejects(pg.query(`INSERT INTO public.sync_job_runs (trigger_type, config_snapshot)
    VALUES ('manual', '{}')`), { code: "23514" })
  await db.insert(syncJobRuns).values([
    { templateId: otherTemplate.id, triggerType: "scheduled", scheduledAt: fetchedAt, configSnapshot: config },
    { templateId: template.id, triggerType: "manual", configSnapshot: config },
    { templateId: template.id, triggerType: "manual", configSnapshot: config },
    { triggerType: "sample", configSnapshot: config },
  ])
  await db.update(syncJobTemplates).set({ config: { ...config, locale: "en-US" } }).where(eq(syncJobTemplates.id, template.id))
  const [persistedRun] = await db.select().from(syncJobRuns).where(eq(syncJobRuns.id, run.id))
  assert.deepEqual(persistedRun.configSnapshot, config)
  const [event] = await db.insert(adminAuditEvents).values({
    actorGithubId: "12345", action: "sync.run.create", targetType: "sync_run", targetId: run.id, outcome: "succeeded",
  }).returning()
  assert.equal(event.actorGithubId, "12345")
  assert.equal(event.targetId, run.id)
  await assert.rejects(pg.query(`INSERT INTO public.admin_audit_events (actor_github_id, action, target_type, outcome)
    VALUES ('synthetic-name', 'sync.run.create', 'sync_run', 'denied')`), { code: "23514" })
})

test("a failed 0002 transaction leaves no partially applied DDL", async (t) => {
  const { pg } = await setup(t)
  await migrate(pg, initial)
  // Force a conflict in the final statement, after both the ALTER and CREATE statements ran.
  await pg.exec("CREATE TABLE public.admin_audit_events (id uuid PRIMARY KEY)")
  await assert.rejects(migrate(pg, incremental), { code: "42P07" })
  const { rows } = await pg.query(`SELECT
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
      AND table_name = 'movies' AND column_name = 'runtime_minutes') AS movie_column_added,
    to_regclass('public.sync_job_templates') IS NOT NULL AS templates_added,
    to_regclass('public.sync_job_runs') IS NOT NULL AS runs_added`)
  assert.deepEqual(rows, [{ movie_column_added: false, templates_added: false, runs_added: false }])
})
