import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import type { Account } from "next-auth";
import { readAuthConfig } from "../src/lib/admin/config";
import { adminCallbacks, adminSessionSeconds, isInvitedGitHubId } from "../src/lib/admin/identity";
import { listRecentAuditEvents, writeOAuthAdmission } from "../src/lib/db/admin-audit";

const github = (id: string): Account => ({ provider: "github", providerAccountId: id, type: "oauth" });

test("invites use canonical numeric account IDs and fail closed on malformed config", () => {
  assert.equal(isInvitedGitHubId("101", " 202, 101 "), true);
  for (const ids of [undefined, "", "101,", "101,login-name", "101,0202"]) {
    assert.equal(isInvitedGitHubId("101", ids), false);
  }
  for (const id of [101, "0101", "admin", "101\n", null]) {
    assert.equal(isInvitedGitHubId(id, "101"), false);
  }

  const env = { AUTH_SECRET: "x".repeat(32), AUTH_GITHUB_ID: "test-id", AUTH_GITHUB_SECRET: "test-secret" };
  for (const origin of ["https://console.example.test", "http://localhost:3000"]) {
    assert.ok(readAuthConfig({ ...env, AUTH_URL: origin }));
  }
  for (const origin of [undefined, "http://console.example.test", "http://127.0.0.1:3000", "http://[::1]:3000", "https://user@host.test", "https://host.test/other", "https://host.test/?x=1"]) {
    assert.equal(readAuthConfig({ ...env, AUTH_URL: origin }), null);
  }
  assert.equal(readAuthConfig({ ...env, AUTH_URL: "https://host.test", AUTH_SECRET: "" }), null);
});

test("callbacks strip profile data; existing sessions honor revocation and absolute expiry", () => {
  let ids = "101";
  let clock = 1000;
  const cb = adminCallbacks(async () => {}, () => ids, () => clock);
  const token = cb.jwt({
    account: github("101"), token: { sub: "other", name: "me", email: "me@example.test", accessToken: "discard-me" },
  });
  assert.deepEqual(token, { githubId: "101", adminIssuedAt: 1 });
  assert.deepEqual(cb.session({ token, session: { expires: "future", user: { githubId: "other" } } }), {
    user: { githubId: "101" }, expires: "1970-01-01T08:00:01.000Z",
  });
  assert.equal(cb.jwt({ token: { sub: "101" } }), null);
  assert.equal(cb.jwt({ token: { ...token, adminIssuedAt: 2 } }), null);
  assert.deepEqual(cb.jwt({ token }), token);
  ids = "202";
  assert.equal(cb.jwt({ token }), null);
  ids = "101";
  clock += adminSessionSeconds * 1000;
  assert.equal(cb.jwt({ token }), null);
});

test("return URLs never leave the configured origin", () => {
  const cb = adminCallbacks(async () => {}, () => "101");
  const baseUrl = "https://console.example.test";
  for (const url of ["https://evil.example/login", "//evil.example/login", "/", "/other"]) {
    assert.equal(cb.redirect({ url, baseUrl }), baseUrl + "/");
  }
  assert.equal(cb.redirect({ url: "/login", baseUrl }), baseUrl + "/login");
});

test("OAuth allow and deny are persisted as narrow audit rows, and write failure rejects", async (t) => {
  const pg = new PGlite();
  t.after(() => pg.close());
  for (const name of ["0001_initial.sql", "0002_mvp_data_layer.sql"]) {
    await pg.exec(readFileSync(new URL("../db/migrations/" + name, import.meta.url), "utf8"));
  }
  const db = drizzle(pg);
  const cb = adminCallbacks((event) => writeOAuthAdmission(db, event), () => "101");
  assert.equal(await cb.signIn({
    account: { ...github("101"), access_token: "synthetic-secret" },
  }), true);
  assert.equal(await cb.signIn({ account: github("202") }), false);
  assert.equal(await cb.signIn({ account: { ...github("101"), provider: "other" } }), false);
  assert.equal(await cb.signIn({ account: github("broken") }), false);

  const events = await listRecentAuditEvents(db);
  assert.deepEqual(events.map(({ actorGithubId, action, targetType, targetId, outcome }) =>
    [actorGithubId, action, targetType, targetId, outcome]), [
    ["202", "admin.oauth.admission", "admin_access", null, "denied"],
    ["101", "admin.oauth.admission", "admin_access", null, "succeeded"],
  ]);
  assert.doesNotMatch(JSON.stringify(events), /synthetic-secret/);
  await pg.exec("DROP TABLE public.admin_audit_events");
  await assert.rejects(cb.signIn({ account: github("101") }));
});
