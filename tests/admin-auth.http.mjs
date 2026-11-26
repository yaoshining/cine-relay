import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";

const sessionCookie = "authjs.session-token";
const protectedPaths = [
  "/", "/jobs", "/jobs/new", "/jobs/daily", "/runs", "/runs/0142", "/movies",
  "/movies/438631", "/credentials", "/consumers", "/audit", "/design-system",
];

async function startApp(t, ids, enabled = true) {
  const socket = createServer().listen(0, "127.0.0.1");
  await once(socket, "listening");
  const { port } = socket.address();
  await new Promise((resolve, reject) => socket.close((error) => error ? reject(error) : resolve()));
  const origin = `http://localhost:${port}`;
  const child = spawn(process.execPath, [
    "--import", "./tests/support/mock-auth-upstreams.mjs", "./node_modules/next/dist/bin/next",
    "start", "--hostname", "127.0.0.1", "--port", String(port),
  ], { env: {
    ...process.env, NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1",
    AUTH_URL: enabled ? origin : "", AUTH_SECRET: "synthetic-test-only-auth-secret-32-characters",
    AUTH_GITHUB_ID: "synthetic-oauth-client", AUTH_GITHUB_SECRET: "synthetic-oauth-secret",
    AUTH_REDIRECT_PROXY_URL: "", ADMIN_GITHUB_IDS: ids,
    DATABASE_URL: "postgresql://synthetic:synthetic@synthetic.neon.invalid/synthetic?sslmode=require",
  }, stdio: ["ignore", "pipe", "pipe"] });
  let log = "";
  for (const stream of [child.stdout, child.stderr]) stream.on("data", (data) => { log += data; });
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      const stopped = once(child, "exit");
      child.kill();
      await stopped;
    }
  });
  const request = (path, options) => fetch(origin + path, { redirect: "manual", ...options, signal: AbortSignal.timeout(5000) });
  for (let i = 0; i < 150 && child.exitCode === null; i++) {
    const ready = await request("/docs/api").catch(() => null);
    if (ready?.ok) {
      await ready.body.cancel();
      return { request, origin, log: () => log };
    }
    await ready?.body?.cancel();
    await delay(50);
  }
  assert.fail(`Local Next server did not start. Run npm run build first.\n${log}`);
}

function readCookies(response, jar = new Map()) {
  for (const entry of response.headers.getSetCookie()) {
    const pair = entry.split(";", 1)[0];
    const offset = pair.indexOf("=");
    const [key, value] = [pair.slice(0, offset), pair.slice(offset + 1)];
    if (value) jar.set(key, value);
    else jar.delete(key);
  }
  return jar;
}
const cookieHeader = (jar) => [...jar].map(([key, value]) => `${key}=${value}`).join("; ");

async function submitAction(app, path, html, jar = new Map()) {
  const action = html.match(/name="(\$ACTION_ID_[^"]+)"/)?.[1];
  assert.ok(action, `Missing server action form at ${path}`);
  const body = new FormData();
  body.append(action, "");
  return app.request(path, { method: "POST", body, headers: { Origin: app.origin, Cookie: cookieHeader(jar) } });
}

async function oauth(app, loginHtml, code, corruptState = false) {
  const begin = await submitAction(app, "/login", loginHtml);
  assert.equal(begin.status, 303, app.log());
  const github = new URL(begin.headers.get("location"));
  assert.equal(github.origin + github.pathname, "https://github.com/login/oauth/authorize");
  assert.equal(github.searchParams.get("redirect_uri"), app.origin + "/api/auth/callback/github");
  assert.equal(github.searchParams.get("scope"), "read:user");
  assert.equal(github.searchParams.get("code_challenge_method"), "S256");
  const state = github.searchParams.get("state");
  assert.ok(state);
  const jar = readCookies(begin);
  await begin.body?.cancel();
  const params = new URLSearchParams({ code, state: corruptState ? "wrong-state" : state });
  const response = await app.request(`/api/auth/callback/github?${params}`, { headers: { Cookie: cookieHeader(jar) } });
  assert.equal(response.status, 302, app.log());
  const target = new URL(response.headers.get("location"), app.origin);
  assert.equal(target.origin, app.origin);
  const setCookies = response.headers.getSetCookie();
  await response.body?.cancel();
  return { jar: readCookies(response, jar), target, setCookies };
}

test("production HTTP: GitHub invitation, audit, route guards, revocation and logout", { timeout: 60_000 }, async (t) => {
  const app = await startApp(t, "101,303");
  const login = await app.request("/login");
  assert.equal(login.status, 200);
  const loginHtml = await login.text();
  assert.match(loginHtml, /使用 GitHub 受邀账户登录/);
  const docs = await app.request("/docs/api");
  assert.equal(docs.status, 200);
  assert.doesNotMatch(await docs.text(), /aria-label="管理后台"|\/api\/admin\/audit/);

  for (const path of protectedPaths) {
    const response = await app.request(path);
    assert.equal(response.status, 307, path);
    assert.equal(response.headers.get("location"), "/login");
    assert.doesNotMatch(await response.text(), /class="sidebar"|深空观测站|每周经典片单增量/);
  }
  const rsc = await app.request("/movies/438631", { headers: { RSC: "1", Authorization: "Bearer synthetic-external" } });
  assert.equal(rsc.status, 307);
  assert.doesNotMatch(await rsc.text(), /深空观测站/);
  const unauthorized = await app.request("/api/admin/audit", { headers: { Authorization: "Bearer synthetic-external" } });
  assert.equal(unauthorized.status, 401);
  assert.match(unauthorized.headers.get("cache-control"), /no-store/);
  assert.deepEqual(await unauthorized.json(), { error: "unauthorized" });

  for (const [code, corruptState] of [["invited", true], ["denied", false], ["write-failure", false]]) {
    const attempt = await oauth(app, loginHtml, code, corruptState);
    assert.equal(attempt.target.pathname, "/login", app.log());
    assert.equal(attempt.jar.has(sessionCookie), false);
  }
  const invited = await oauth(app, loginHtml, "invited");
  assert.equal(invited.target.pathname, "/", app.log());
  assert.ok(invited.jar.has(sessionCookie), app.log());
  assert.ok(invited.setCookies.some((cookie) => cookie.startsWith(sessionCookie + "=") && /HttpOnly.*SameSite=Lax/i.test(cookie)));
  const headers = { Cookie: cookieHeader(invited.jar) };
  const dashboard = await app.request("/", { headers });
  assert.equal(dashboard.status, 200);
  assert.match(dashboard.headers.get("cache-control"), /no-store/);
  assert.match(await dashboard.text(), /运营总览/);
  const audit = await app.request("/api/admin/audit", { headers });
  assert.equal(audit.status, 200);
  assert.match(audit.headers.get("cache-control"), /no-store/);
  const { events } = await audit.json();
  assert.deepEqual(events.map(({ actorGithubId, outcome }) => [actorGithubId, outcome]), [["101", "succeeded"], ["202", "denied"]]);
  const auditPage = await app.request("/audit", { headers });
  const auditHtml = await auditPage.text();
  assert.match(auditHtml, /GitHub OAuth 登录准入/);
  assert.doesNotMatch(auditHtml, /do-not-retain@example.test/);
  const session = await app.request("/api/auth/session", { headers });
  const data = await session.json();
  assert.deepEqual(data.user, { githubId: "101" });
  assert.doesNotMatch(JSON.stringify(data), /do-not-retain@example.test|access_token/);

  const reconfigured = await startApp(t, "202");
  const revoked = await reconfigured.request("/api/admin/audit", { headers });
  assert.equal(revoked.status, 401);
  await revoked.body.cancel();
  const revokedPage = await reconfigured.request("/", { headers });
  assert.equal(revokedPage.status, 307);
  await revokedPage.body.cancel();

  const logout = await submitAction(app, "/audit", auditHtml, invited.jar);
  assert.equal(logout.status, 303, app.log());
  assert.equal(new URL(logout.headers.get("location"), app.origin).pathname, "/login");
  assert.ok(logout.headers.getSetCookie().some((entry) => entry.startsWith(sessionCookie + "=;")));
  await logout.body?.cancel();
  assert.doesNotMatch(app.log(), /do-not-retain@example.test|synthetic-oauth-secret|postgresql:\/\//);
});

test("unconfigured production still serves public routes and fails closed", { timeout: 30_000 }, async (t) => {
  const app = await startApp(t, "101", false);
  const login = await app.request("/login");
  assert.equal(login.status, 200);
  assert.match(await login.text(), /GitHub 登录尚未配置/);
  for (const [path, status] of [["/audit", 307], ["/api/admin/audit", 401], ["/api/auth/providers", 503]]) {
    const response = await app.request(path);
    assert.equal(response.status, status);
    await response.body?.cancel();
  }
});
