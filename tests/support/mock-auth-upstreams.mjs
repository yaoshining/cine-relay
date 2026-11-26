// Preloaded only by the local HTTP test. No OAuth or database traffic leaves loopback.
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const originalFetch = globalThis.fetch;
const accepted = new Map([["invited", 101], ["denied", 202], ["write-failure", 303]]);
let database;
async function openDb() {
  const db = new PGlite();
  for (const name of ["0001_initial.sql", "0002_mvp_data_layer.sql"]) {
    await db.exec(readFileSync(new URL("../../db/migrations/" + name, import.meta.url), "utf8"));
  }
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
  if (url.href === "https://api.neon.invalid/sql") {
    const { query, params } = JSON.parse(init.body);
    if (params.includes("303")) return new Response(null, { status: 503 });
    const db = await (database ??= openDb());
    const result = await db.query(query, params, { rowMode: "array", parsers: { 1184: (value) => value } });
    return Response.json({ ...result, rowCount: result.affectedRows ?? result.rows.length });
  }
  throw new Error("Unexpected upstream during HTTP test");
};
