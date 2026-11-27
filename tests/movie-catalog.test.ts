import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { listMovieCatalog, readMovieCatalogDetail } from "../src/lib/db/movie-catalog";
import { catalogHref, parseCatalogParams, parseTmdbId } from "../src/lib/movie-catalog";

const asOf = "2026-02-01T00:00:00.000000Z";

test("catalog URL inputs are bounded and preserve precise IDs", () => {
  assert.equal(parseTmdbId("9223372036854775807"), 9223372036854775807n);
  for (const invalid of ["9223372036854775808", "0", "001", "1.0", "1e2", "-1", "99\n"]) {
    assert.equal(parseTmdbId(invalid), null);
  }
  const filters = parseCatalogParams({ q: "  100%_雪  ", lang: "zh-CN", state: "stale", view: "list", page: "2" });
  assert.equal(catalogHref(filters), "/movies?q=100%25_%E9%9B%AA&lang=zh-CN&state=stale&view=list&page=2");
  assert.equal(catalogHref(filters, { view: "grid", page: 1 }), "/movies?q=100%25_%E9%9B%AA&lang=zh-CN&state=stale");
  assert.deepEqual(parseCatalogParams({ q: ["x", "y"], lang: "xx", state: "constructor", page: "10001" }),
    { query: "", locale: null, state: null, sort: "recent", view: "grid", page: 1 });
  assert.equal(parseCatalogParams({ q: "x\0" + "雪".repeat(200) }).query.length, 120);
});

test("Postgres catalog reads exact IDs and literal titles, filters lifecycle boundaries and never writes", async (t) => {
  const pg = new PGlite();
  t.after(() => pg.close());
  for (const file of ["0001_initial.sql", "0002_mvp_data_layer.sql"]) {
    await pg.exec(readFileSync(new URL("../db/migrations/" + file, import.meta.url), "utf8"));
  }
  await pg.exec(`
    insert into public.movies (tmdb_id, original_title, release_date, genre_ids, original_language, runtime_minutes, removed_at)
    values (9007199254740993, 'ECHO Original', '2024-12-01', '{878}', 'ja', 98, null),
           (102, 'Not a match', null, '{}', null, null, null),
           (103, 'Archive', null, '{}', null, null, null),
           (104, 'Retired', null, '{}', null, null, '2026-01-20T09:00:00Z'),
           (105, 'Metadata only', null, '{}', null, null, null);
    insert into public.movie_localizations (tmdb_id, locale, title, fetched_at, expires_at, purge_after)
    values (9007199254740993, 'zh-CN', '回声 100%_!', '2026-01-01Z', '2026-02-01T00:00:00.000001Z', '2026-03-01Z'),
           (9007199254740993, 'en-US', 'Echo Localized', '2026-01-01Z', '2026-02-01Z', '2026-03-01Z'),
           (102, 'zh-CN', '回声 100XY', '2026-01-01Z', '2026-02-01Z', '2026-03-01Z'),
           (103, 'en-US', 'Archive localized', '2026-01-01Z', '2026-01-20Z', '2026-02-01Z'),
           (104, 'zh-CN', '退役缓存', '2026-01-01Z', '2026-01-20Z', '2026-02-01Z');
  `);
  // Every product read must also work with database write permissions disabled.
  await pg.exec("SET default_transaction_read_only = on");
  const db = drizzle(pg);
  const run = (params: Parameters<typeof parseCatalogParams>[0]) => listMovieCatalog(db, parseCatalogParams(params), asOf);
  const idMatch = await run({ q: "#9007199254740993" });
  assert.deepEqual(idMatch.entries.map((x) => [x.tmdbId, x.locale, x.status]), [
    ["9007199254740993", "en-US", "stale"], ["9007199254740993", "zh-CN", "fresh"],
  ]);
  assert.equal((await run({ q: "900719925474099" })).entries.length, 0);
  assert.equal((await run({ q: "9223372036854775808" })).entries.length, 0);
  assert.equal((await run({ q: "echo original" })).entries.length, 2);
  assert.equal((await run({ q: "ECHO LOCALIZED", lang: "zh-CN" })).entries.length, 0);
  assert.deepEqual((await run({ q: "100%_!" })).entries.map((row) => row.title), ["回声 100%_!"]);
  assert.deepEqual((await run({ state: "fresh", lang: "zh-CN" })).entries.map((row) => row.tmdbId), ["9007199254740993"]);
  assert.deepEqual((await run({ state: "retained_until_passed" })).entries.map((row) => row.tmdbId), ["103"]);
  assert.deepEqual((await run({ state: "removed" })).entries.map((row) => row.tmdbId), ["104"]);
  const sorted = (await run({ sort: "title", lang: "en-US" })).entries;
  assert.deepEqual(sorted.map((row) => row.tmdbId), ["103", "9007199254740993"]);

  const full = await readMovieCatalogDetail(db, 9007199254740993n, asOf);
  assert.ok(full);
  assert.equal(full.movie.runtimeMinutes, 98);
  assert.deepEqual(full.movie.genreIds, [878]);
  assert.equal(full.localizations.length, 2);
  assert.match(full.localizations.find((row) => row.locale === "zh-CN")!.expiresAt, /\.000001/);
  const missing = await readMovieCatalogDetail(db, 105n, asOf);
  assert.equal(missing?.movie.originalTitle, "Metadata only");
  assert.deepEqual(missing?.localizations, []);
  assert.equal(await readMovieCatalogDetail(db, 999n, asOf), null);
});

test("catalog pagination is bounded and stable for equal sort keys", async (t) => {
  const pg = new PGlite();
  t.after(() => pg.close());
  await pg.exec(readFileSync(new URL("../db/migrations/0001_initial.sql", import.meta.url), "utf8"));
  await pg.exec(`
    insert into public.movies (tmdb_id) select generate_series(1, 24);
    insert into public.movie_localizations (tmdb_id, locale, title, fetched_at, expires_at, purge_after)
    select tmdb_id, 'zh-CN', 'Synthetic', '2026-01-01Z', '2026-01-21Z', '2026-03-01Z'
    from public.movies;
  `);
  const db = drizzle(pg);
  for (const sort of ["recent", "title"]) {
    const first = await listMovieCatalog(db, parseCatalogParams({ sort }), asOf);
    const second = await listMovieCatalog(db, parseCatalogParams({ sort, page: "2" }), asOf);
    assert.equal(first.entries.length, 20);
    assert.equal(first.hasNext, true);
    assert.equal(second.hasNext, false);
    assert.deepEqual([...first.entries, ...second.entries].map((row) => row.tmdbId), Array.from({ length: 24 }, (_, i) => String(i + 1)));
  }
});
