import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { parseSyncForm } from "../src/lib/sync/config";
import { fetchSampleOutcome, sampleSummarySchema } from "../src/lib/sync/sample";
import { createSampleRun, findRun, findTemplate, finishSampleRun, listRuns, listTemplates, noteSyncDispatchFailure, queueSyncDispatchRetry, saveTemplate, startSampleRun } from "../src/lib/db/sync-runs";
import * as schema from "../src/lib/db/schema";
import { backfillItems, createBackfill, createBackfillRetry, findBackfillRetry, finishBackfill, fixBackfillPlan, markFetched, noteFetchFailure, startBackfill, storeFetchedMovie, type FetchedMovie } from "../src/lib/db/backfill";
import { findMovieCache } from "../src/lib/db/movie-cache";
import { createTmdbMovieClient } from "../src/lib/tmdb/movie-client";

const migrations = ["0001_initial.sql", "0002_mvp_data_layer.sql", "0003_sync_sample_runs.sql", "0004_manual_sync_items.sql", "0007_incremental_schedule.sql"];
function form() {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    name: " 法国片样本 ", mode: "backfill", releaseFrom: "2025-01-01", releaseThrough: "2025-12-31",
    originalLanguage: "fr", locale: "zh-CN", limit: "25", fieldGroup: "movie_details", schedule: "weekly", weekday: "3", hour: "9",
  })) data.set(key, value);
  data.append("genreId", "18");
  return data;
}

test("sync form validates schedule, selection and field group before dispatch", () => {
  const data = form();
  const { data: config } = parseSyncForm(data);
  assert.equal(config?.name, "法国片样本");
  assert.deepEqual(config?.schedule, { kind: "weekly", weekday: 3, hour: 9, timezone: "Asia/Shanghai" });
  for (const [key, value] of [["hour", "24"], ["releaseThrough", "2024-12-31"], ["fieldGroup", "arbitrary"], ["limit", "1e2"]]) {
    const invalid = form();
    invalid.set(key, value);
    assert.equal(parseSyncForm(invalid).success, false);
  }
});

test("sample state survives dispatch failure, preserves snapshot and never mutates cache or cursor", async (t) => {
  const client = new PGlite();
  t.after(() => client.close());
  for (const name of migrations.slice(0, 2)) await client.exec(await readFile("db/migrations/" + name, "utf8"));
  await client.exec(`insert into sync_job_runs(trigger_type,config_snapshot) values ('sample','{"name":"existing"}');
    insert into sync_cursors(stream,cursor_state) values ('legacy','{"page":8}')`);
  await client.exec(await readFile("db/migrations/" + migrations[2], "utf8"));
  for (const name of migrations.slice(3)) await client.exec(await readFile("db/migrations/" + name, "utf8"));
  const db = drizzle(client, { schema });
  const config = parseSyncForm(form()).data!;
  const templateId = (await saveTemplate(db, config, "101"))!;
  assert.ok(templateId);
  assert.equal(await createSampleRun(db, config, "101", "00000000-0000-4000-8000-000000000000").catch(() => null), null);
  await assert.rejects(saveTemplate(db, { ...config, name: "invalid actor" }, "invalid"));
  assert.equal((await listTemplates(db)).length, 1);
  const runId = (await createSampleRun(db, config, "101", templateId))!;
  assert.ok(runId);
  const edited = { ...config, name: "新版模板" };
  assert.equal(await saveTemplate(db, edited, "101", templateId), templateId);
  assert.deepEqual((await findTemplate(db, templateId))?.config, edited);
  await noteSyncDispatchFailure(db, runId);
  assert.equal((await findRun(db, runId))?.status, "dispatch_failed");
  assert.equal(await queueSyncDispatchRetry(db, runId, "101"), runId);
  assert.equal(await queueSyncDispatchRetry(db, runId, "101"), null);
  assert.deepEqual(await startSampleRun(db, runId), config);
  assert.deepEqual(await startSampleRun(db, runId), config);
  await noteSyncDispatchFailure(db, runId);
  assert.equal((await findRun(db, runId))?.status, "running");

  const request: typeof fetch = async (input) =>
    String(input).includes("/discover/") ? Response.json({ results: [{ id: 7 }, { id: 8 }, { id: 9 }], total_pages: 1 }) :
    String(input).includes("/movie/7?") ? Response.json({ id: 7, title: "合成电影", overview: "简介", genres: [] }) :
    new Response("raw error must not be retained", { status: 429, headers: { "Retry-After": "30" } });
  const outcome = await fetchSampleOutcome(createTmdbMovieClient("synthetic", request, () => Date.UTC(2026, 0, 1)), config.selection);
  assert.equal(outcome.status, "partial_failed");
  assert.ok(sampleSummarySchema.safeParse(outcome.summary).success);
  await finishSampleRun(db, runId, outcome);
  await noteSyncDispatchFailure(db, runId);
  assert.equal(await startSampleRun(db, runId), null);
  await finishSampleRun(db, runId, { status: "failed", summary: { kind: "failure", code: "execution_failed", retryAt: null } });
  const run = await findRun(db, runId);
  assert.equal(run?.status, "partial_failed");
  assert.deepEqual(run?.resultSummary, outcome.summary);
  assert.equal((await listRuns(db)).length, 2);
  assert.equal((await db.select().from(schema.movies)).length, 0);
  assert.equal((await db.select().from(schema.movieLocalizations)).length, 0);
  assert.equal((await db.select().from(schema.movieSyncJobs)).length, 0);
  assert.deepEqual((await db.select().from(schema.syncCursors))[0].cursorState, { page: 8 });
  const audit = await db.select().from(schema.adminAuditEvents);
  assert.equal(audit.length, 4);
  assert.ok(audit.every((row) => row.actorGithubId === "101"));
});

function fixtureMovie(tmdbId: number, fetchedAt = "2026-01-01T00:00:00.123Z", title = "合成同步电影"): FetchedMovie {
  return { tmdbId, fetchedAt, title, locale: "zh-CN", originalTitle: "Synthetic", originalLanguage: "fr",
    releaseDate: "2025-04-20", runtimeMinutes: 110, genreIds: [18], overview: null, posterPath: null, titleProvided: true, overviewProvided: false };
}

test("manual backfill separates fetch and commit, preserves timestamps and retries only unfinished items", async (t) => {
  const pg = new PGlite();
  t.after(() => pg.close());
  for (const name of migrations) await pg.exec(await readFile("db/migrations/" + name, "utf8"));
  await pg.exec("SET TIME ZONE 'UTC'");
  const db = drizzle(pg, { schema });
  const config = parseSyncForm(form()).data!;
  const templateId = (await saveTemplate(db, config, "101"))!;
  const incrementalId = (await saveTemplate(db, { ...config, mode: "incremental" }, "101"))!;
  assert.equal(await createBackfill(db, incrementalId, "101"), null);
  await assert.rejects(createBackfill(db, templateId, "invalid"));
  assert.equal((await listRuns(db)).length, 0);
  const runId = (await createBackfill(db, templateId, "101"))!;
  await saveTemplate(db, { ...config, name: "新模板" }, "101", templateId);
  assert.deepEqual((await startBackfill(db, runId))?.config_snapshot, config);
  await fixBackfillPlan(db, runId, [10, 10, 11, 12, 13, 14], false);
  await fixBackfillPlan(db, runId, [999], false);
  assert.deepEqual((await backfillItems(db, runId)).map((item) => item.tmdbId), [10n, 11n, 12n, 13n, 14n]);

  const movie = fixtureMovie(10);
  await markFetched(db, runId, movie);
  await pg.exec("ALTER TABLE public.movie_localizations ADD CHECK (title <> '合成同步电影')");
  await assert.rejects(storeFetchedMovie(db, runId, movie));
  assert.equal((await backfillItems(db, runId))[0].status, "fetched");
  assert.equal((await db.select().from(schema.movies)).length, 0);
  await pg.exec("ALTER TABLE public.movie_localizations DROP CONSTRAINT movie_localizations_title_check");
  await storeFetchedMovie(db, runId, movie);
  await storeFetchedMovie(db, runId, movie); // Callback replay after a successful commit.
  const stored = (await findMovieCache(db, 10n, "zh-CN"))!;
  assert.equal(stored.movie.runtimeMinutes, 110);
  assert.equal(stored.localization.fetchedAt, "2026-01-01 00:00:00.123+00");
  assert.equal(stored.localization.expiresAt, "2026-01-08 00:00:00.123+00");
  assert.equal(stored.localization.purgeAfter, "2026-01-31 00:00:00.123+00");

  await pg.exec("INSERT INTO public.movies(tmdb_id,removed_at) VALUES (11,now())");
  const removed = fixtureMovie(11);
  await markFetched(db, runId, removed);
  await storeFetchedMovie(db, runId, removed);
  assert.equal(await findMovieCache(db, 11n, "zh-CN"), null);
  await noteFetchFailure(db, runId, 12, "not_found");
  await noteFetchFailure(db, runId, 13, "rate_limited");
  assert.equal(await finishBackfill(db, runId, "rate_limited", "2099-01-01T00:00:00.000Z"), "partial_failed");
  assert.deepEqual((await backfillItems(db, runId)).map(({ status }) => status), ["stored", "removed", "failed", "failed", "deferred"]);
  assert.equal(await startBackfill(db, runId), null);
  assert.equal(await createBackfillRetry(db, runId, "101"), null);
  await pg.query("UPDATE public.sync_job_runs SET result_summary = result_summary || '{\"retryAt\":\"2000-01-01T00:00:00Z\"}'::jsonb WHERE id=$1", [runId]);
  const child = (await createBackfillRetry(db, runId, "101"))!;
  assert.equal(await createBackfillRetry(db, runId, "101"), null);
  assert.equal(await findBackfillRetry(db, runId), child);
  assert.equal((await startBackfill(db, child))?.planned, true);
  assert.deepEqual((await findRun(db, child))?.configSnapshot, config);
  assert.deepEqual((await backfillItems(db, child)).map(({ tmdbId }) => tmdbId), [12n, 13n, 14n]);

  for (const copy of [fixtureMovie(10, movie.fetchedAt, "同时间"), fixtureMovie(10, "2025-01-01T00:00:00.000Z", "旧值")]) {
    const stale = (await createBackfill(db, templateId, "101"))!;
    await startBackfill(db, stale);
    await fixBackfillPlan(db, stale, [10], false);
    await markFetched(db, stale, copy);
    await storeFetchedMovie(db, stale, copy);
    assert.equal((await backfillItems(db, stale))[0].status, "unchanged");
    assert.equal(await finishBackfill(db, stale), "completed");
  }
  assert.deepEqual(await findMovieCache(db, 10n, "zh-CN"), stored);
  assert.equal((await db.select().from(schema.syncCursors)).length, 0);
  assert.equal((await db.select().from(schema.movieSyncJobs)).length, 0);
});
