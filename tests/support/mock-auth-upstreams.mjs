// Preloaded only by the local HTTP test. No OAuth or database traffic leaves loopback.
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const originalFetch = globalThis.fetch;
const accepted = new Map([["invited", 101], ["denied", 202], ["write-failure", 303]]);
let database;
let failFirstStore = true;
async function openDb() {
  const db = new PGlite();
  for (const name of ["0001_initial.sql", "0002_mvp_data_layer.sql", "0003_sync_sample_runs.sql", "0004_manual_sync_items.sql", "0005_consumer_api.sql", "0006_tmdb_credentials.sql", "0007_incremental_schedule.sql"]) {
    await db.exec(readFileSync(new URL("../../db/migrations/" + name, import.meta.url), "utf8"));
  }
  await db.exec(`
    insert into public.movies (tmdb_id, original_title, genre_ids, release_date, original_language, runtime_minutes)
    values (9007199254740993, 'Synthetic original', '{878,18}', '2025-12-01', 'ja', 109);
    insert into public.movie_localizations (tmdb_id, locale, title, overview, poster_path, fetched_at, expires_at, purge_after)
    values (9007199254740993, 'zh-CN', '合成缓存影片', '测试用译文简介', '/synthetic.jpg', now(), now() + interval '7 days', now() + interval '30 days');
  `);
  return db;
}

globalThis.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : input);
  if (url.hostname === "127.0.0.1" || url.hostname === "localhost") return originalFetch(input, init);
  if (url.href === "https://github.com/login/oauth/access_token") {
    const params = new URLSearchParams(init?.body);
    const code = params.get("code");
    if (!accepted.has(code) || !params.get("code_verifier")) return new Response(null, { status: 400 });
    return Response.json({ access_token: code, token_type: "bearer" });
  }
  if (url.href === "https://api.github.com/user") {
    const authorization = new Headers(init?.headers).get("Authorization");
    const id = accepted.get(authorization?.replace(/^Bearer /, ""));
    return id ? Response.json({ id, email: "do-not-retain@example.test" }) : new Response(null, { status: 401 });
  }
  if (url.hostname === "inngest.invalid" && url.pathname === "/e/synthetic-event-key") {
    const [event] = JSON.parse(init.body);
    const kind = /^cinerelay\/sync\.(sample|backfill)\.requested$/.exec(event.name)?.[1];
    if (!kind || event.id !== "cinerelay-" + kind + "-" + event.data.runId
      || Object.keys(event.data).join(",") !== "runId") return new Response(null, { status: 422 });
    return Response.json({ status: 200, ids: [event.id] });
  }
  if (url.hostname === "api.themoviedb.org") {
    const auth = new Headers(init?.headers).get("authorization");
    if (auth !== "Bearer synthetic-tmdb-token" && auth !== "Bearer synthetic-tmdb-token-with-pool") return new Response(null, { status: 401 });
    if (url.pathname === "/3/discover/movie") return Response.json({ results: [{ id: 70 }, { id: 71 }, { id: 72 }], total_pages: 1 });
    if (url.pathname === "/3/movie/70") return Response.json({ id: 70, title: "合成试抓片名", genres: [] });
    if (url.pathname === "/3/movie/71") return new Response("sensitive synthetic body", { status: 429, headers: { "Retry-After": "30" } });
    throw new Error("Unexpected synthetic movie request");
  }
  if (url.href === "https://api.neon.invalid/sql") {
    const { query, params } = JSON.parse(init.body);
    if (failFirstStore && query.includes("for update of i") && query.includes("insert into public.movie_localizations")) {
      failFirstStore = false;
      return new Response(null, { status: 503 });
    }
    if (params.some((param) => ["303", "%synthetic-db-error%", "50001"].includes(param))) return new Response(null, { status: 503 });
    const db = await (database ??= openDb());
    const rawText = (value) => value;
    const result = await db.query(query, params, {
      rowMode: "array",
      // Match Neon's raw-text wire format (including boolean values).
      parsers: Object.fromEntries([16, 20, 23, 1007, 1082, 1184, 3802].map((id) => [id, rawText])),
    });
    return Response.json({ ...result, rowCount: result.affectedRows ?? result.rows.length });
  }
  throw new Error("Unexpected upstream during HTTP test");
};
