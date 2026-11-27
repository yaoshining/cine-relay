import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "../src/lib/db/schema";
import { authorizeConsumer, issueConsumerKey, listConsumerKeys, revokeConsumerKey } from "../src/lib/db/consumer-keys";
import { withTmdbPermit } from "../src/lib/db/tmdb-gate";
import { movieDetail } from "../src/lib/consumer/movie-detail";
import { consumerMovieSchema } from "../src/lib/consumer/openapi";
import { TmdbRequestError } from "../src/lib/tmdb/movie-client";
import { openCredential, parsePoolKey, sealCredential } from "../src/lib/tmdb/credential-crypto";

test("pool credentials use randomized authenticated encryption bound to their row", () => {
  const key = parsePoolKey(Buffer.alloc(32, 42).toString("base64"))!;
  assert.equal(parsePoolKey("bad-key"), null);
  const sealed = sealCredential(key, "row-a", "synthetic-token");
  assert.notEqual(sealed, sealCredential(key, "row-a", "synthetic-token"));
  assert.equal(openCredential(key, "row-a", sealed), "synthetic-token");
  assert.throws(() => openCredential(key, "row-b", sealed));
  assert.throws(() => openCredential(Buffer.alloc(32, 41), "row-a", sealed));
});

test("external keys and exact cache lifecycle; concurrent misses do not duplicate upstream requests", async (t) => {
  const pg = new PGlite();
  t.after(() => pg.close());
  for (const file of (await readdir("db/migrations")).filter((name) => name.endsWith(".sql")).sort()) {
    await pg.exec(await readFile("db/migrations/" + file, "utf8"));
  }
  const db = drizzle(pg, { schema });
  const key = (await issueConsumerKey(db, "Synthetic VidAll", "101"))!;
  assert.equal(await authorizeConsumer(db, "Bearer " + key.token), true);
  assert.equal(await authorizeConsumer(db, "Bearer " + key.token.slice(0, -1)), false);
  assert.ok(!(JSON.stringify(await listConsumerKeys(db))).includes(key.token));
  assert.equal(await revokeConsumerKey(db, key.id, "101"), key.id);
  assert.equal(await authorizeConsumer(db, "Bearer " + key.token), false);

  const time = Date.UTC(2026, 0, 1);
  let fetchCount = 0;
  let unblock!: () => void;
  let dispatched!: () => void;
  const pending = new Promise<void>((resolve) => { unblock = resolve; });
  const fetching = new Promise<void>((resolve) => { dispatched = resolve; });
  const client = () => ({ detail: async () => {
    fetchCount++;
    dispatched();
    await pending;
    return { tmdbId: 10, locale: "zh-CN" as const, title: "合成新片", originalTitle: null, originalLanguage: null,
      releaseDate: null, runtimeMinutes: null, genreIds: [], overview: null, posterPath: null,
      fetchedAt: new Date(time).toISOString(), titleProvided: true, overviewProvided: false };
  }});
  const first = movieDetail(db, 10n, "zh-CN", client, () => time);
  await fetching;
  try {
    assert.equal((await movieDetail(db, 10n, "zh-CN", client, () => time)).status, 503);
  } finally { unblock(); }
  const result = await first;
  assert.equal(result.status, 200);
  assert.equal(consumerMovieSchema.parse(await result.json()).cache, "refreshed");
  assert.equal(fetchCount, 1);
  const valid = await movieDetail(db, 10n, "zh-CN", () => { throw Error("Must not reach upstream"); }, () => time);
  assert.equal(consumerMovieSchema.parse(await valid.json()).cache, "hit");

  const retryAt = new Date(Date.now() + 60000).toISOString();
  await assert.rejects(withTmdbPermit(db, async () => { throw new TmdbRequestError("rate_limited", retryAt); }), { code: "rate_limited" });
  const blocked = () => ({ detail: async () => withTmdbPermit(db, async () => { throw Error("Must respect shared cooldown"); }) });
  const stale = await movieDetail(db, 10n, "zh-CN", blocked, () => time + 7 * 86400000);
  assert.equal(consumerMovieSchema.parse(await stale.json()).cache, "stale");
  assert.equal((await movieDetail(db, 10n, "zh-CN", blocked, () => time + 30 * 86400000)).status, 503);
  await pg.exec("UPDATE public.movies SET removed_at = now() WHERE tmdb_id = 10");
  assert.equal((await movieDetail(db, 10n, "en-US", client, () => time)).status, 404);
  assert.equal(fetchCount, 1);
});
