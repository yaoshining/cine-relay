import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { backfillItems, createBackfill, startBackfill } from "../src/lib/db/backfill";
import { changeWindow, claimIncrementalPlan, commitChangeWindow } from "../src/lib/db/incremental";
import { cursorMatchesTemplate, enqueueDueTemplates, listRecoverableDispatches, rebuildIncrementalCursor, setScheduleEnabled } from "../src/lib/db/schedules";
import { findRun, findTemplate, listRuns, saveTemplate } from "../src/lib/db/sync-runs";
import * as schema from "../src/lib/db/schema";
import type { SyncConfig } from "../src/lib/sync/config";

test("Beijing scheduling deduplicates slots and incremental windows atomically queue eligible cached films", async (t) => {
  const pg = new PGlite();
  t.after(() => pg.close());
  for (const name of (await readdir("db/migrations")).sort()) if (name.endsWith(".sql")) await pg.exec(await readFile("db/migrations/" + name, "utf8"));
  const db = drizzle(pg, { schema });
  const rounded = Math.floor(Date.now() / 3_600_000) * 3_600_000;
  const slot = new Date(rounded).toISOString();
  const local = new Date(rounded + 8 * 3_600_000);
  const config: SyncConfig = {
    version: 1, name: "合成增量", mode: "incremental", fieldGroup: "movie_details",
    schedule: { kind: "weekly", weekday: local.getUTCDay() || 7, hour: local.getUTCHours(), timezone: "Asia/Shanghai" },
    selection: { releaseFrom: "2025-01-01", releaseThrough: "2025-12-31", locale: "zh-CN", originalLanguage: "ja", genreIds: [18], limit: 1 },
  };
  const templateId = (await saveTemplate(db, config, "101"))!;
  assert.equal(await setScheduleEnabled(db, templateId, true, "101"), null);
  assert.equal(await createBackfill(db, templateId, "101"), null);
  await rebuildIncrementalCursor(db, templateId, "101");
  assert.equal(await cursorMatchesTemplate(db, templateId), true);
  assert.equal(await setScheduleEnabled(db, templateId, true, "101"), templateId);
  await enqueueDueTemplates(db, new Date(rounded + 3_600_000).toISOString());
  assert.equal((await listRuns(db)).length, 0);
  await enqueueDueTemplates(db, slot);
  await enqueueDueTemplates(db, slot);
  const runs = await listRuns(db);
  assert.equal(runs.length, 1);
  assert.equal(runs[0].triggerType, "scheduled");
  const id = runs[0].id;
  assert.equal((await listRecoverableDispatches(db))[0]?.id, id);
  await startBackfill(db, id);
  await pg.query("update public.sync_cursors set cursor_state=cursor_state||'{\"through\":\"2020-01-01\"}'::jsonb where stream=$1", ["changes:" + templateId]);
  const window = (await changeWindow(db, id))!;
  assert.deepEqual(window, { previous: "2020-01-01", through: "2020-01-14" });
  await pg.exec(`INSERT INTO public.movies (tmdb_id,release_date,original_language,genre_ids,removed_at) VALUES
    (101,'2025-03-04','ja','{18}',null),(102,'2025-03-04','ja','{18,12}',null),
    (103,'2025-03-04','en','{18}',null),(104,'2025-03-04','ja','{18}',now())`);
  await pg.exec("alter table public.sync_incremental_pending add constraint injected_failure check (tmdb_id <> 101)");
  await assert.rejects(commitChangeWindow(db, id, window.previous, window.through, [101,102,103,104,101,999]));
  assert.deepEqual(await changeWindow(db, id), window);
  await pg.exec("alter table public.sync_incremental_pending drop constraint injected_failure");
  await commitChangeWindow(db, id, window.previous, window.through, [101,102,103,104,101,999]);
  assert.equal((await changeWindow(db, id))?.previous, "2020-01-14");
  assert.equal(await claimIncrementalPlan(db, id, config.selection.limit), true);
  assert.equal(await claimIncrementalPlan(db, id, config.selection.limit), true);
  assert.deepEqual((await backfillItems(db, id)).map((item) => item.tmdbId), [101n]);
  const next = (await createBackfill(db, templateId, "101"))!;
  await startBackfill(db, next);
  assert.equal(await claimIncrementalPlan(db, next, config.selection.limit), true);
  assert.deepEqual((await backfillItems(db, next)).map((item) => item.tmdbId), [102n]);
  const stale = (await createBackfill(db, templateId, "101"))!;
  await startBackfill(db, stale);
  await saveTemplate(db, { ...config, selection: { ...config.selection, genreIds: [12] } }, "101", templateId);
  assert.equal((await findTemplate(db, templateId))?.enabled, false);
  assert.equal(await changeWindow(db, stale), null);
  assert.equal(await claimIncrementalPlan(db, stale, 1), false);
  await rebuildIncrementalCursor(db, templateId, "101");
  assert.equal(await cursorMatchesTemplate(db, templateId), true);
  assert.equal(await claimIncrementalPlan(db, stale, 1), false);
  assert.notEqual((await findRun(db, stale))?.cursorGeneration, (await findRun(db, (await createBackfill(db, templateId, "101"))!))?.cursorGeneration);
});
