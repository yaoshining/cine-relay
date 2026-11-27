import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHmac } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:net";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";

const sessionCookie = "authjs.session-token";
const protectedPaths = [
  "/", "/jobs", "/jobs/new", "/jobs/daily", "/runs", "/runs/0142", "/movies",
  "/movies/438631", "/credentials", "/consumers", "/audit", "/design-system",
];

const syntheticSigningKey = "a".repeat(64);
async function startApp(t, ids, enabled = true, sync = false, pool = false, scheduler = false) {
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
    INNGEST_EVENT_API_BASE_URL: "https://inngest.invalid",
    INNGEST_EVENT_KEY: sync ? "synthetic-event-key" : "",
    INNGEST_SIGNING_KEY: sync ? "signkey-test-" + syntheticSigningKey : "",
    TMDB_READ_TOKEN: sync && !pool ? "synthetic-tmdb-token" : "",
    TMDB_KEY_ENCRYPTION_KEY: pool ? Buffer.alloc(32, 42).toString("base64") : undefined,
    // Production must ignore the opt-in demo flag, even if it is set.
    CINERELAY_INNGEST_LOCAL: "1",
    CINERELAY_SYNC_SCHEDULER: scheduler ? "1" : "0",
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

async function submitAction(app, path, html, jar = new Map(), origin = app.origin) {
  const action = html.match(/name="(\$ACTION_ID_[^"]+)"/)?.[1];
  assert.ok(action, `Missing server action form at ${path}`);
  const body = new FormData();
  body.append(action, "");
  return app.request(path, { method: "POST", body, headers: { Origin: origin, Cookie: cookieHeader(jar) } });
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
  const callbackPath = `/api/auth/callback/github?${params}`;
  const response = await app.request(callbackPath, { headers: { Cookie: cookieHeader(jar) } });
  assert.equal(response.status, 302, app.log());
  const target = new URL(response.headers.get("location"), app.origin);
  assert.equal(target.origin, app.origin);
  const setCookies = response.headers.getSetCookie();
  await response.body?.cancel();
  return { jar: readCookies(response, jar), target, setCookies, callbackPath };
}

test("production HTTP: GitHub invitation, audit, route guards, revocation and logout", { timeout: 60_000 }, async (t) => {
  const app = await startApp(t, "101,303");
  const login = await app.request("/login");
  assert.equal(login.status, 200);
  const loginHtml = await login.text();
  assert.match(loginHtml, /使用 GitHub 受邀账户登录/);
  const docs = await app.request("/docs/api");
  assert.equal(docs.status, 200);
  const docsHtml = await docs.text();
  assert.doesNotMatch(docsHtml, /aria-label="管理后台"|\/api\/admin\/audit|管理员登录/);
  assert.match(docsHtml, /<a\b[^>]*href="\/"[^>]*>[\s\S]*?返回 CineRelay<\/a>/);
  const cssPaths = [...docsHtml.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"?]+\.css)"/g)].map(([, href]) => href);
  const styles = await Promise.all(cssPaths.map(async (path) => {
    const stylesheet = await app.request(path);
    assert.equal(stylesheet.status, 200);
    return stylesheet.text();
  }));
  assert.ok(styles.some((css) => css.includes(".references-layout") && css.includes("--refs-sidebar-width")),
    "The public docs must load Scalar's official page layout CSS");

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
  // The original callback consumed its OAuth cookies. Replaying it must still fail,
  // but the resulting error page should honor the already established session.
  assert.equal(invited.jar.has("authjs.state"), false);
  assert.equal(invited.jar.has("authjs.pkce.code_verifier"), false);
  const repeated = await app.request(invited.callbackPath, { headers });
  assert.equal(repeated.status, 302);
  const callbackError = new URL(repeated.headers.get("location"), app.origin);
  assert.equal(callbackError.origin, app.origin);
  assert.equal(callbackError.pathname, "/login");
  assert.equal(callbackError.searchParams.get("error"), "Configuration");
  assert.ok(repeated.headers.getSetCookie().every((cookie) => !cookie.startsWith(sessionCookie + "=")));
  assert.match(app.log(), /\[admin-auth\] InvalidCheck/);
  await repeated.body?.cancel();
  const errorPath = callbackError.pathname + callbackError.search;
  const recovered = await app.request(errorPath, { headers });
  assert.equal(recovered.status, 307);
  assert.equal(recovered.headers.get("location"), "/");
  await recovered.body?.cancel();
  const anonymousError = await app.request(errorPath);
  assert.equal(anonymousError.status, 200);
  assert.match(await anonymousError.text(), /暂时无法完成登录/);
  const dashboard = await app.request("/", { headers });
  assert.equal(dashboard.status, 200);
  assert.match(dashboard.headers.get("cache-control"), /no-store/);
  assert.match(await dashboard.text(), /运营总览/);
  const catalog = await app.request("/movies?q=%239007199254740993&lang=zh-CN&state=fresh&view=list", { headers });
  assert.equal(catalog.status, 200);
  assert.match(catalog.headers.get("cache-control"), /no-store/);
  const catalogHtml = await catalog.text();
  assert.match(catalogHtml, /合成缓存影片/);
  assert.match(catalogHtml, /href="\/movies\/9007199254740993\?lang=zh-CN"/);
  assert.doesNotMatch(catalogHtml, /海街晨光|https:\/\/image\.tmdb\.org/);
  const detail = await app.request("/movies/9007199254740993", { headers });
  assert.equal(detail.status, 200);
  const detailHtml = await detail.text();
  assert.match(detailHtml, /测试用译文简介/);
  assert.match(detailHtml, /科幻 \/ 剧情/);
  assert.match(detailHtml, /109 分钟/);
  assert.match(detailHtml, /data-fresh="true"/);
  const missingTranslation = await app.request("/movies/9007199254740993?lang=en-US", { headers });
  assert.equal(missingTranslation.status, 200);
  const missingTranslationHtml = await missingTranslation.text();
  assert.match(missingTranslationHtml, /该语言尚无缓存/);
  assert.doesNotMatch(missingTranslationHtml, /测试用译文简介/);
  for (const path of ["/movies/99999", "/movies/9223372036854775808", "/movies/9007199254740993?lang=invalid"]) {
    const missing = await app.request(path, { headers });
    assert.equal(missing.status, 404, path);
    await missing.body?.cancel();
  }
  for (const path of ["/movies?q=synthetic-db-error", "/movies/50001"]) {
    const unavailable = await app.request(path, { headers });
    assert.match(await unavailable.text(), /暂时无法读取电影缓存/);
  }
  const empty = await app.request("/movies?q=absent", { headers });
  assert.match(await empty.text(), /没有匹配的缓存记录/);

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
  const revokedError = await reconfigured.request(errorPath, { headers });
  assert.equal(revokedError.status, 200);
  assert.match(await revokedError.text(), /暂时无法完成登录/);
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

test("production HTTP: only the exact EdgeOne public host can start login across the proxy", { timeout: 30_000 }, async (t) => {
  const app = await startApp(t, "101");
  const login = await app.request("/login");
  const html = await login.text();
  const allowed = await submitAction(app, "/login", html, undefined, "https://cine-relay.vidall.top");
  assert.equal(allowed.status, 303, app.log());
  const github = new URL(allowed.headers.get("location"));
  assert.equal(github.origin + github.pathname, "https://github.com/login/oauth/authorize");
  assert.equal(github.searchParams.get("redirect_uri"), app.origin + "/api/auth/callback/github");
  await allowed.body?.cancel();
  for (const origin of ["https://other.vidall.top", "https://cine-relay.vidall.top.example.invalid"]) {
    const rejected = await submitAction(app, "/login", html, undefined, origin);
    assert.equal(rejected.status, 500);
    assert.equal(rejected.headers.get("location"), null);
    assert.equal(rejected.headers.getSetCookie().length, 0);
    await rejected.body?.cancel();
  }
});

const canonical = (v) => {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === "object") return Object.fromEntries(Object.keys(v).sort().map((key) => [key, canonical(v[key])]));
  return v;
};

async function signedExecution(app, runId, steps = {}, kind = "sample", timestampOverride) {
  const cron = kind === "schedule";
  const payload = JSON.stringify(canonical({
    event: cron ? { data: { cron: "0 * * * *" }, name: "inngest/scheduled.timer", ts: timestampOverride }
      : { data: { runId }, name: `cinerelay/sync.${kind}.requested` },
    steps, version: 2, ctx: { run_id: "01J00000000000000000000001" },
  }));
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", syntheticSigningKey).update(payload + timestamp).digest("hex");
  const response = await app.request(`/api/inngest?fnId=cine-relay-${cron ? "scan-sync-schedules" : "sync-" + kind}&stepId=step`, {
    method: "POST", body: payload, headers: { "Content-Type": "application/json", "X-Inngest-Signature": `t=${timestamp}&s=${signature}` },
  });
  // Include the structured executor outcome when a protocol assertion fails.
  return { status: response.status, body: await response.json() };
}

const decodeAttribute = (value) => value.replace(/&(quot|amp|lt|gt|#x27);/g, (_, ch) => ({ quot: '"', amp: "&", lt: "<", gt: ">", "#x27": "'" }[ch]));

async function submitBoundAction(app, html, path, jar, marker, entries = {}) {
  const body = new FormData();
  const form = (html.match(/<form\b[^>]*>[\s\S]*?<\/form>/g) ?? []).find((item) => item.includes(marker));
  const action = form?.match(/name="\$ACTION_REF_([^"]+)"/)?.[1];
  assert.ok(action, "Expected a bound sync form action");
  const escaped = action.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  for (const input of form.matchAll(/<input[^>]*>/g)) {
    const key = input[0].match(/ name="([^"]+)"/)?.[1];
    if (!key || !new RegExp(`^\\$ACTION_(REF_${escaped}$|${escaped}:)|^\\$ACTION_KEY$`).test(key)) continue;
    const value = input[0].match(/ value="([^"]*)"/)?.[1] ?? "";
    body.append(key, decodeAttribute(value));
  }
  for (const [key, value] of Object.entries(entries)) body.append(key, value);
  return app.request(path, { method: "POST", body, headers: { Origin: app.origin, Cookie: cookieHeader(jar) } });
}

function submitJob(app, html, path, jar, intent, name, options = {}) {
  return submitBoundAction(app, html, path, jar, 'name="intent"', {
    intent, name, mode: "backfill", releaseFrom: "2025-01-01", releaseThrough: "2025-12-31", genreId: "18",
    originalLanguage: "", locale: "zh-CN", limit: "25", fieldGroup: "movie_details", schedule: "manual", ...options,
  });
}

test("production HTTP: guarded sync forms and signed sample execution", { timeout: 30_000 }, async (t) => {
  const app = await startApp(t, "101", true, true);
  const loginHtml = await (await app.request("/login")).text();
  const { jar } = await oauth(app, loginHtml, "invited");
  const headers = { Cookie: cookieHeader(jar) };
  assert.match(await (await app.request("/jobs", { headers })).text(), /暂无任务模板/);
  const unsigned = await app.request("/api/inngest?fnId=cine-relay-sync-sample", { method: "POST", body: "{}" });
  assert.equal(unsigned.status, 401);
  await unsigned.body.cancel();
  const path = "/jobs/new";
  const form = await (await app.request(path, { headers })).text();
  assert.match(form, /试抓最多 5 部/);

  const anonymous = await submitJob(app, form, path, new Map(), "save", "unauthorized");
  assert.equal(anonymous.status, 303, app.log());
  assert.equal(new URL(anonymous.headers.get("location"), app.origin).pathname, "/login");
  await anonymous.body.cancel();

  const save = await submitJob(app, form, path, jar, "save", "合成模板");
  assert.equal(save.status, 303, app.log());
  const editPath = new URL(save.headers.get("location"), app.origin).pathname;
  assert.match(editPath, /^\/jobs\/[0-9a-f-]{36}$/);
  await save.body.cancel();
  const edit = await (await app.request(editPath, { headers })).text();
  assert.match(edit, /合成模板/);
  const sample = await submitJob(app, edit, editPath, jar, "sample", "未保存的配置快照");
  assert.equal(sample.status, 303, app.log());
  const runPath = new URL(sample.headers.get("location"), app.origin).pathname;
  assert.match(runPath, /^\/runs\/[0-9a-f-]{36}$/);
  await sample.body.cancel();
  const pending = await (await app.request(runPath, { headers })).text();
  assert.match(pending, /排队中/);
  assert.match(pending, /未保存的配置快照/);

  const runId = runPath.split("/").at(-1);
  const steps = {};
  for (const name of ["load-run", "sample-movies", "persist-result"]) {
    const result = await signedExecution(app, runId, steps);
    assert.equal(result.status, 206, JSON.stringify(result));
    assert.equal(result.body[0].name, name, JSON.stringify(result));
    steps[result.body[0].id] = { type: "data", data: result.body[0].data };
  }
  const replay = await signedExecution(app, runId);
  assert.equal(replay.status, 206, JSON.stringify(replay));
  assert.equal(replay.body[0].data, null);
  const diagnosis = await (await app.request(runPath, { headers })).text();
  assert.match(diagnosis, /部分失败/);
  assert.match(diagnosis, /合成试抓片名/);
  assert.match(diagnosis, /TMDB 限流/);
  assert.match(diagnosis, /入库 0/);
  assert.doesNotMatch(diagnosis, /sensitive synthetic body|synthetic-tmdb-token/);
  assert.match(await (await app.request("/runs", { headers })).text(), /未保存的配置快照/);
  assert.match(await (await app.request("/audit", { headers })).text(), /申请试抓/);
});

test("production HTTP: signed backfill retries only its failed store", { timeout: 30_000 }, async (t) => {
  const app = await startApp(t, "101", true, true);
  const loginHtml = await (await app.request("/login")).text();
  const { jar } = await oauth(app, loginHtml, "invited");
  const headers = { Cookie: cookieHeader(jar) };
  const create = await (await app.request("/jobs/new", { headers })).text();
  const save = await submitJob(app, create, "/jobs/new", jar, "save", "合成模板");
  assert.equal(save.status, 303, app.log());
  const editPath = new URL(save.headers.get("location"), app.origin).pathname;
  await save.body.cancel();
  const edit = await (await app.request(editPath, { headers })).text();

  const denied = await submitBoundAction(app, edit, editPath, new Map(), "立即同步");
  assert.equal(new URL(denied.headers.get("location"), app.origin).pathname, "/login");
  await denied.body.cancel();
  const manual = await submitBoundAction(app, edit, editPath, jar, "立即同步");
  assert.equal(manual.status, 303, app.log());
  const manualPath = new URL(manual.headers.get("location"), app.origin).pathname;
  assert.match(manualPath, /^\/runs\/[0-9a-f-]{36}$/);
  await manual.body.cancel();
  const manualId = manualPath.split("/").at(-1);
  const manualSteps = {};
  async function next(name) {
    const result = await signedExecution(app, manualId, manualSteps, "backfill");
    assert.equal(result.status, 206, JSON.stringify(result));
    assert.equal(result.body[0].name, name, JSON.stringify(result));
    manualSteps[result.body[0].id] = { type: "data", data: result.body[0].data ?? null };
    return result.body[0].data;
  }
  for (const step of ["load-run", "discover-movies", "fix-movie-list", "load-movie-list", "fetch-movie-70", "record-fetch-70"]) await next(step);
  const failedCommit = await signedExecution(app, manualId, manualSteps, "backfill");
  assert.match(JSON.stringify(failedCommit.body), /Backfill progress could not be saved or read/);
  assert.doesNotMatch(JSON.stringify(failedCommit.body), /postgresql:\/\/|synthetic-tmdb-token/);
  const waiting = await (await app.request(manualPath, { headers })).text();
  assert.match(waiting, /已抓取 1 · 已入库 0/);
  assert.equal((await app.request("/movies/70", { headers })).status, 404);
  for (const step of ["store-movie-70", "fetch-movie-71", "record-fetch-failure-71", "finish-run"]) await next(step);
  const finished = await (await app.request(manualPath, { headers })).text();
  assert.match(finished, /已抓取 1 · 已入库 1/);
  assert.match(finished, /部分失败/);
  assert.match(finished, /未尝试 · 已停止/);
  assert.match(await (await app.request("/movies/70", { headers })).text(), /合成试抓片名/);
  const terminalReplay = await signedExecution(app, manualId, {}, "backfill");
  assert.equal(terminalReplay.body[0].data, null);
  assert.match(await (await app.request("/audit", { headers })).text(), /申请正式同步/);
});

test("production HTTP: external keys, cache-first detail and public OpenAPI", { timeout: 30_000 }, async (t) => {
  const app = await startApp(t, "101", true, true);
  const pkg = await app.request("/api/v1/openapi.json");
  const contract = await pkg.json();
  assert.deepEqual(Object.keys(contract.paths), ["/api/v1/movies/{tmdbId}"]);
  const path = "/api/v1/movies/9007199254740993";
  const anonymous = await app.request(path);
  assert.equal(anonymous.status, 401);
  assert.equal(anonymous.headers.get("www-authenticate"), "Bearer");
  await anonymous.body.cancel();
  const { jar } = await oauth(app, await (await app.request("/login")).text(), "invited");
  const headers = { Cookie: cookieHeader(jar) };
  const adminOnly = await app.request(path, { headers });
  assert.equal(adminOnly.status, 401);
  await adminOnly.body.cancel();
  const page = await (await app.request("/consumers", { headers })).text();
  const issued = await submitBoundAction(app, page, "/consumers", jar, 'name="name"', { name: "合成 VidAll 服务端" });
  assert.equal(issued.status, 200, app.log());
  const token = (await issued.text()).match(/cr_live_[A-Za-z0-9_-]{43}/)?.[0];
  assert.ok(token, "Expected one-time key");
  const caller = { Authorization: `Bearer ${token}` };
  const fresh = await app.request(path, { headers: caller });
  assert.equal(fresh.status, 200);
  assert.equal(fresh.headers.get("cache-control"), "private, no-store");
  const cached = await fresh.json();
  assert.equal(cached.tmdbId, "9007199254740993");
  assert.equal(cached.cache, "hit");
  const refreshed = await app.request("/api/v1/movies/70", { headers: caller });
  assert.equal(refreshed.status, 200);
  assert.equal((await refreshed.json()).cache, "refreshed");
  const repeated = await app.request("/api/v1/movies/70", { headers: caller });
  assert.equal((await repeated.json()).cache, "hit");
  const limited = await app.request("/api/v1/movies/71", { headers: caller });
  assert.equal(limited.status, 503);
  assert.ok(Number(limited.headers.get("retry-after")) > 0);
  await limited.body.cancel();
  const keys = await (await app.request("/consumers", { headers })).text();
  assert.ok(!keys.includes(token));
  const revoke = await submitBoundAction(app, keys, "/consumers", jar, ">撤销<");
  assert.equal(revoke.status, 200);
  await revoke.body.cancel();
  const revoked = await app.request(path, { headers: caller });
  assert.equal(revoked.status, 401);
  await revoked.body.cancel();
  const audit = await (await app.request("/audit", { headers })).text();
  assert.match(audit, /撤销应用密钥/);
  assert.ok(!audit.includes(token));
});

test("production HTTP: TMDB pool isolates a rejected credential and shares 429 cooldown", { timeout: 30_000 }, async (t) => {
  const app = await startApp(t, "101", true, true, true);
  const { jar } = await oauth(app, await (await app.request("/login")).text(), "invited");
  const headers = { Cookie: cookieHeader(jar) };
  const secret = "synthetic-tmdb-token-with-pool";
  const deniedToken = "synthetic-tmdb-rejected-credential";
  const page = "/credentials";
  for (const [name, token] of [["合成坏凭据", deniedToken], ["合成好凭据", secret]]) {
    const form = await (await app.request(page, { headers })).text();
    const addition = await submitBoundAction(app, form, page, jar, 'name="token"', { name, token });
    const result = await addition.text();
    assert.equal(addition.status, 200, app.log());
    assert.match(result, /已加密保存/);
    assert.ok(!result.includes(token));
  }
  const issuePage = await (await app.request("/consumers", { headers })).text();
  const issued = await submitBoundAction(app, issuePage, "/consumers", jar, 'name="name"', { name: "Synthetic pool consumer" });
  const token = (await issued.text()).match(/cr_live_[A-Za-z0-9_-]{43}/)?.[0];
  assert.ok(token);
  const auth = { Authorization: `Bearer ${token}` };
  const denied = await app.request("/api/v1/movies/70", { headers: auth });
  assert.equal(denied.status, 503);
  await denied.body.cancel();
  const success = await app.request("/api/v1/movies/70", { headers: auth });
  assert.equal(success.status, 200);
  await success.body.cancel();
  const limited = await app.request("/api/v1/movies/71", { headers: auth });
  assert.equal(limited.status, 503);
  await limited.body.cancel();
  const cooling = await app.request("/api/v1/movies/72", { headers: auth });
  assert.equal(cooling.status, 503);
  await cooling.body.cancel();
  const list = await (await app.request(page, { headers })).text();
  assert.match(list, /共享冷却至/);
  assert.match(list, /上游拒绝 · 已隔离/);
  assert.match(list, /上游限流/);
  assert.ok(!list.includes(secret) && !list.includes(deniedToken));
  assert.doesNotMatch(app.log(), /synthetic-tmdb-(token-with-pool|rejected-credential)/);
});

test("production HTTP: enabled Beijing schedule queues and dispatches only one run per slot", { timeout: 30_000 }, async (t) => {
  const app = await startApp(t, "101", true, true, false, true);
  const { jar } = await oauth(app, await (await app.request("/login")).text(), "invited");
  const headers = { Cookie: cookieHeader(jar) };
  const now = Date.now();
  const local = new Date(now + 8 * 3_600_000);
  const form = await (await app.request("/jobs/new", { headers })).text();
  const save = await submitJob(app, form, "/jobs/new", jar, "save", "合成定时回填", { schedule: "daily", hour: String(local.getUTCHours()) });
  assert.equal(save.status, 303);
  const url = new URL(save.headers.get("location"), app.origin).pathname;
  await save.body.cancel();
  const edit = await (await app.request(url, { headers })).text();
  const enabled = await submitBoundAction(app, edit, url, jar, "开启定时");
  assert.equal(enabled.status, 303, app.log());
  await enabled.body.cancel();
  for (const attempt of [1,2]) {
    const steps = {};
    for (const name of ["enqueue-current-hour", "find-pending-dispatches", null]) {
      const result = await signedExecution(app, null, steps, "schedule", now);
      assert.equal(result.status, 206, JSON.stringify(result));
      const step = result.body[0];
      if (name) assert.equal(step.name, name);
      else assert.match(step.name, /^dispatch-/);
      if (name === "find-pending-dispatches") assert.equal(step.data.length, 1, `attempt ${attempt}`);
      steps[step.id] = { type: "data", data: step.data ?? null };
    }
  }
  const runs = await (await app.request("/runs", { headers })).text();
  assert.match(runs, /合成定时回填/);
  assert.equal(new Set(runs.match(/href="\/runs\/[0-9a-f-]{36}"/g)).size, 1);
});

test("unconfigured production still serves public routes and fails closed", { timeout: 30_000 }, async (t) => {
  const app = await startApp(t, "101", false);
  const login = await app.request("/login");
  assert.equal(login.status, 200);
  assert.match(await login.text(), /GitHub 登录尚未配置/);
  for (const [path, status] of [["/audit", 307], ["/api/admin/audit", 401], ["/api/auth/providers", 503], ["/api/inngest", 503]]) {
    const response = await app.request(path);
    assert.equal(response.status, status);
    await response.body?.cancel();
  }
});
