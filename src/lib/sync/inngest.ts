import "server-only";

import { Inngest } from "inngest";
import { getDb } from "@/lib/db/client";
import { finishSampleRun, noteSyncDispatchFailure, startSampleRun } from "@/lib/db/sync-runs";
import { enqueueDueTemplates, listRecoverableDispatches } from "@/lib/db/schedules";
import { changeWindow, claimIncrementalPlan, commitChangeWindow } from "@/lib/db/incremental";
import { backfillItems, backfillLimit, finishBackfill, fixBackfillPlan, markFetched, noteFetchFailure, startBackfill, storeFetchedMovie } from "@/lib/db/backfill";
import { TmdbRequestError } from "@/lib/tmdb/movie-client";
import { maintainTv } from "@/lib/db/tv-demand";
import { tvClient } from "@/lib/tmdb/tv-client";
import { managedTvTransport, managedTmdbClient, tmdbConfigured } from "@/lib/tmdb/managed-client";
import { movieSelectionSchema } from "@/lib/tmdb/movie-selection";
import { syncConfigSchema, templateIdSchema } from "./config";
import { fetchSampleOutcome, sampleFailure } from "./sample";

export const sampleRequested = "cinerelay/sync.sample.requested";
export const backfillRequested = "cinerelay/sync.backfill.requested";

export const localInngestDemo = process.env.NODE_ENV === "development" && process.env.CINERELAY_INNGEST_LOCAL === "1";

export function sampleConfigured() {
  return !localInngestDemo && tmdbConfigured() && [process.env.INNGEST_EVENT_KEY, process.env.INNGEST_SIGNING_KEY].every((value) => Boolean(value?.trim()));
}

export const inngest = new Inngest({
  id: "cine-relay",
  // The opt-in local mode only serves a side-effect-free demonstration.
  // Normal runs still require signatures, even in Next.js development.
  isDev: localInngestDemo,
  ...(localInngestDemo && { baseUrl: "http://127.0.0.1:8288" }),
});

export const tvPrefetchEnabled = !localInngestDemo && process.env.CINERELAY_TV_PREFETCH === "1";
export const tvPrefetch = inngest.createFunction({id:"tv-prefetch",triggers:[{cron:"*/10 * * * *"}],retries:0,concurrency:1}, async () => {
  if (!tvPrefetchEnabled) return {status:"disabled"};
  try { return await maintainTv(getDb(),()=>tvClient(managedTvTransport(true))); }
  catch(err){if(err instanceof TmdbRequestError)return {status:err.code};throw new Error("TV maintenance failed");}
});

export const schedulerEnabled = !localInngestDemo && process.env.CINERELAY_SYNC_SCHEDULER === "1";

export async function sendSyncEvent(runId: string, type: "sample" | "manual" | "scheduled") {
  if (localInngestDemo) throw new Error("Sync dispatch is disabled in local demo mode");
  await inngest.send({ name: type === "sample" ? sampleRequested : backfillRequested,
    id: `cinerelay-${type === "sample" ? "sample" : "backfill"}-${runId}`, data: { runId } });
}

export const validateMovieSelection = inngest.createFunction({
  id: "validate-movie-selection",
  name: "Validate Movie Selection",
  triggers: [{ event: "cinerelay/dev.movie-selection.requested" }],
}, async ({ event, step }) => {
  return step.run("validate-selection", () => {
    const result = movieSelectionSchema.safeParse(event.data?.selection);
    return result.success
      ? { valid: true, selection: result.data }
      : { valid: false, error: "invalid_selection" };
  });
});

function eventId(data: unknown) {
  if (!data || typeof data !== "object" || !("runId" in data)) return null;
  return templateIdSchema.safeParse(data.runId).data ?? null;
}

async function persist(runId: string, result: Awaited<ReturnType<typeof fetchSampleOutcome>>) {
  try {
    await finishSampleRun(getDb(), runId, result);
  } catch {
    throw new Error("Sample result could not be persisted");
  }
}

export const sampleRun = inngest.createFunction({
  id: "sync-sample",
  triggers: [{ event: sampleRequested }],
  retries: 2,
  concurrency: 1,
  singleton: { key: "event.data.runId", mode: "skip" },
  onFailure: async ({ event, step }) => {
    const id = eventId(event.data.event.data);
    if (id) await step.run("mark-failed", () => persist(id, sampleFailure("execution_failed")));
  },
}, async ({ event, step }) => {
  const id = eventId(event.data);
  if (!id) return { ignored: true };
  const snapshot = await step.run("load-run", async () => {
    try {
      return await startSampleRun(getDb(), id);
    } catch {
      throw new Error("Sample run could not be loaded");
    }
  });
  if (!snapshot) return { ignored: true };

  const outcome = await step.run("sample-movies", async () => {
    const config = syncConfigSchema.safeParse(snapshot);
    if (!config.success) return sampleFailure("invalid_config");
    if (!tmdbConfigured()) return sampleFailure("not_configured");
    return fetchSampleOutcome(managedTmdbClient(), config.data.selection);
  });
  await step.run("persist-result", () => persist(id, outcome));
  return { status: outcome.status };
});

async function backfillDb<T>(query: () => Promise<T>) {
  try {
    return await query();
  } catch {
    // Driver errors may contain query parameters. Don't send them to Inngest.
    throw new Error("Backfill progress could not be saved or read");
  }
}

function upstreamFailure(error: unknown) {
  if (!(error instanceof TmdbRequestError)) throw error;
  return { code: error.code, retryAt: error.retryAt };
}

export const backfillRun = inngest.createFunction({
  id: "sync-backfill",
  triggers: [{ event: backfillRequested }],
  retries: 2,
  concurrency: 1,
  singleton: { key: "event.data.runId", mode: "skip" },
  onFailure: async ({ event, step }) => {
    const id = eventId(event.data.event.data);
    if (id) await step.run("mark-failed", () => backfillDb(() => finishBackfill(getDb(), id, "execution_failed")));
  },
}, async ({ event, step }) => {
  const id = eventId(event.data);
  if (!id) return { ignored: true };
  const run = await step.run("load-run", () => backfillDb(() => startBackfill(getDb(), id)));
  if (!run) return { ignored: true };
  const finish = (code: string | null = null, retryAt: string | null = null) =>
    step.run("finish-run", () => backfillDb(() => finishBackfill(getDb(), id, code, retryAt)));

  const config = syncConfigSchema.safeParse(run.config_snapshot);
  if (!config.success) return { status: await finish("invalid_config") };
  if (!tmdbConfigured()) return { status: await finish("not_configured") };
  const client = managedTmdbClient();
  const { selection } = config.data;

  if (!run.planned && config.data.mode === "incremental") {
    const window = await step.run("read-incremental-window", () => backfillDb(() => changeWindow(getDb(), id)));
    if (!window) return { status: await finish("cursor_reset_required") };
    if (window.through > window.previous) {
      const ids = new Set<number>();
      let expectedPages = 1;
      for (let page = 1; page <= expectedPages; page++) {
        const result = await step.run(`read-changes-page-${page}`, async () => {
          try {
            return { kind: "success" as const, ...await client.changesPage(window.previous, window.through, page) };
          } catch (error) {
            return { kind: "failure" as const, ...upstreamFailure(error) };
          }
        });
        if (result.kind === "failure") return { status: await finish(result.code, result.retryAt) };
        if (page === 1) expectedPages = result.pages;
        if (result.pages !== expectedPages || expectedPages > 50) return { status: await finish("incomplete_window") };
        for (const tmdbId of result.ids) ids.add(tmdbId);
      }
      await step.run("commit-incremental-window", () => backfillDb(() => commitChangeWindow(getDb(), id, window.previous, window.through, [...ids])));
    }
    const claimed = await step.run("claim-incremental-movies", () => backfillDb(() => claimIncrementalPlan(getDb(), id, selection.limit)));
    if (!claimed) return { status: await finish("cursor_reset_required") };
  } else if (!run.planned) {
    const discovery = await step.run("discover-movies", async () => {
      try {
        return { kind: "success" as const, ...await client.discover({ ...selection, limit: Math.min(selection.limit, backfillLimit) }, 2) };
      } catch (error) {
        return { kind: "failure" as const, ...upstreamFailure(error) };
      }
    });
    if (discovery.kind === "failure") return { status: await finish(discovery.code, discovery.retryAt) };
    await step.run("fix-movie-list", () => backfillDb(() => fixBackfillPlan(getDb(), id, discovery.ids, discovery.pageLimitReached)));
  }

  const ids = await step.run("load-movie-list", () => backfillDb(async () =>
    (await backfillItems(getDb(), id)).filter((item) => item.status === "pending").map((item) => Number(item.tmdbId))));
  for (const tmdbId of ids) {
    const fetched = await step.run(`fetch-movie-${tmdbId}`, async () => {
      try {
        return { kind: "success" as const, movie: await client.detail(tmdbId, selection.locale) };
      } catch (error) {
        return { kind: "failure" as const, ...upstreamFailure(error) };
      }
    });
    if (fetched.kind === "failure") {
      await step.run(`record-fetch-failure-${tmdbId}`, () => backfillDb(() => noteFetchFailure(getDb(), id, tmdbId, fetched.code)));
      if (fetched.code === "rate_limited" || fetched.code === "unauthorized" || fetched.code === "budget_unavailable") {
        return { status: await finish(fetched.code, fetched.retryAt) };
      }
      continue;
    }
    await step.run(`record-fetch-${tmdbId}`, () => backfillDb(() => markFetched(getDb(), id, fetched.movie)));
    await step.run(`store-movie-${tmdbId}`, () => backfillDb(() => storeFetchedMovie(getDb(), id, fetched.movie)));
  }
  return { status: await finish() };
});

export const scanSyncSchedules = inngest.createFunction({
  id: "scan-sync-schedules",
  triggers: [{ cron: "0 * * * *" }],
  retries: 2,
  concurrency: 1,
}, async ({ event, step }) => {
  if (!schedulerEnabled || !sampleConfigured()) return { skipped: "scheduler_not_configured" };
  await step.run("enqueue-current-hour", async () => {
    const eventTime = typeof event.ts === "number" ? event.ts : Date.now();
    const slot = new Date(Math.floor(eventTime / 3_600_000) * 3_600_000).toISOString();
    await backfillDb(() => enqueueDueTemplates(getDb(), slot));
  });
  const runs = await step.run("find-pending-dispatches", () => backfillDb(() => listRecoverableDispatches(getDb())));
  let sent = 0;
  for (const run of runs) {
    const success = await step.run(`dispatch-${run.id}`, async () => {
      try {
        await sendSyncEvent(run.id, run.trigger_type);
        return true;
      } catch {
        await backfillDb(() => noteSyncDispatchFailure(getDb(), run.id, run.trigger_type));
        return false;
      }
    });
    if (success) sent++;
  }
  return { sent };
});
