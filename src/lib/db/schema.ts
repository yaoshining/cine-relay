import { sql } from "drizzle-orm"
import {
  bigint, boolean, check, date, foreignKey, index, integer, jsonb, pgTable,
  primaryKey, text, timestamp, unique, uuid,
} from "drizzle-orm/pg-core"

export * from './tv-schema';

export const movieLocales = ["zh-CN", "en-US"] as const
export type MovieLocale = (typeof movieLocales)[number]

type JsonObject = Record<string, unknown>

const instant = (name: string) => timestamp(name, { withTimezone: true, mode: "string" })

// SQL migrations are authoritative. Keep the legacy tables and names aligned
// with 0001, even where the application does not yet use a table.
export const movies = pgTable("movies", {
  tmdbId: bigint("tmdb_id", { mode: "bigint" }).primaryKey(),
  originalTitle: text("original_title"),
  releaseDate: date("release_date", { mode: "string" }),
  genreIds: integer("genre_ids").array().notNull().default(sql`'{}'`),
  updatedAt: instant("updated_at").notNull().defaultNow(),
  removedAt: instant("removed_at"),
  originalLanguage: text("original_language"),
  runtimeMinutes: integer("runtime_minutes"),
}, (t) => [
  check("movies_tmdb_id_check", sql`${t.tmdbId} > 0`),
  check("movies_original_language_check", sql`${t.originalLanguage} ~ '^[a-z]{2}$'`),
  check("movies_runtime_minutes_check", sql`${t.runtimeMinutes} > 0`),
])

export const movieLocalizations = pgTable("movie_localizations", {
  tmdbId: bigint("tmdb_id", { mode: "bigint" }).notNull(),
  locale: text("locale", { enum: movieLocales }).notNull(),
  title: text("title").notNull(),
  overview: text("overview"),
  posterPath: text("poster_path"),
  fetchedAt: instant("fetched_at").notNull(),
  expiresAt: instant("expires_at").notNull(),
  purgeAfter: instant("purge_after").notNull(),
}, (t) => [
  primaryKey({ name: "movie_localizations_pkey", columns: [t.tmdbId, t.locale] }),
  foreignKey({
    name: "movie_localizations_tmdb_id_fkey", columns: [t.tmdbId], foreignColumns: [movies.tmdbId],
  }).onDelete("cascade"),
  check("movie_localizations_locale_check", sql`${t.locale} IN ('zh-CN', 'en-US')`),
  check("movie_localizations_check", sql`${t.fetchedAt} < ${t.expiresAt} AND ${t.expiresAt} <= ${t.purgeAfter}`),
  index("movie_localizations_purge_after_idx").on(t.purgeAfter),
])

export const syncCursors = pgTable("sync_cursors", {
  stream: text("stream").primaryKey(),
  cursorState: jsonb("cursor_state").$type<JsonObject>().notNull(),
  updatedAt: instant("updated_at").notNull().defaultNow(),
}, (t) => [
  check("sync_cursors_cursor_state_check", sql`jsonb_typeof(${t.cursorState}) = 'object'`),
])

export const movieSyncJobs = pgTable("movie_sync_jobs", {
  tmdbId: bigint("tmdb_id", { mode: "bigint" }).notNull(),
  locale: text("locale", { enum: movieLocales }).notNull(),
  status: text("status", { enum: ["pending", "leased", "failed"] }).notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  nextAttemptAt: instant("next_attempt_at").notNull().defaultNow(),
  leaseToken: uuid("lease_token"),
  leasedUntil: instant("leased_until"),
  lastError: text("last_error"),
  createdAt: instant("created_at").notNull().defaultNow(),
  updatedAt: instant("updated_at").notNull().defaultNow(),
}, (t) => [
  primaryKey({ name: "movie_sync_jobs_pkey", columns: [t.tmdbId, t.locale] }),
  check("movie_sync_jobs_tmdb_id_check", sql`${t.tmdbId} > 0`),
  check("movie_sync_jobs_locale_check", sql`${t.locale} IN ('zh-CN', 'en-US')`),
  check("movie_sync_jobs_status_check", sql`${t.status} IN ('pending', 'leased', 'failed')`),
  check("movie_sync_jobs_attempts_check", sql`${t.attempts} >= 0`),
  check("movie_sync_jobs_check", sql`(${t.status} = 'leased' AND ${t.leaseToken} IS NOT NULL AND ${t.leasedUntil} IS NOT NULL)
    OR (${t.status} IN ('pending', 'failed') AND ${t.leaseToken} IS NULL AND ${t.leasedUntil} IS NULL)`),
  index("movie_sync_jobs_pending_idx").on(t.nextAttemptAt, t.tmdbId, t.locale).where(sql`${t.status} = 'pending'`),
  index("movie_sync_jobs_lease_idx").on(t.leasedUntil).where(sql`${t.status} = 'leased'`),
])

export const syncJobTemplates = pgTable("sync_job_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  mode: text("mode", { enum: ["backfill", "incremental"] }).notNull(),
  config: jsonb("config").$type<JsonObject>().notNull(),
  enabled: boolean("enabled").notNull().default(false),
  createdAt: instant("created_at").notNull().defaultNow(),
  updatedAt: instant("updated_at").notNull().defaultNow(),
}, (t) => [
  check("sync_job_templates_name_check", sql`btrim(${t.name}) <> ''`),
  check("sync_job_templates_mode_check", sql`${t.mode} IN ('backfill', 'incremental')`),
  check("sync_job_templates_config_check", sql`jsonb_typeof(${t.config}) = 'object'`),
])

export const syncJobRuns = pgTable("sync_job_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  templateId: uuid("template_id"),
  triggerType: text("trigger_type", { enum: ["manual", "sample", "scheduled"] }).notNull(),
  status: text("status", { enum: ["queued", "dispatch_failed", "running", "completed", "partial_failed", "failed"] }).notNull().default("queued"),
  configSnapshot: jsonb("config_snapshot").$type<JsonObject>().notNull(),
  resultSummary: jsonb("result_summary").$type<JsonObject>(),
  retryOf: uuid("retry_of"),
  cursorGeneration: uuid("cursor_generation"),
  scheduledAt: instant("scheduled_at"),
  startedAt: instant("started_at"),
  finishedAt: instant("finished_at"),
  createdAt: instant("created_at").notNull().defaultNow(),
}, (t) => [
  foreignKey({ name: "sync_job_runs_template_id_fkey", columns: [t.templateId], foreignColumns: [syncJobTemplates.id] }),
  check("sync_job_runs_trigger_type_check", sql`${t.triggerType} IN ('manual', 'sample', 'scheduled')`),
  check("sync_job_runs_status_check", sql`${t.status} IN ('queued', 'dispatch_failed', 'running', 'completed', 'partial_failed', 'failed')`),
  check("sync_job_runs_config_snapshot_check", sql`jsonb_typeof(${t.configSnapshot}) = 'object'`),
  check("sync_job_runs_template_check", sql`${t.triggerType} = 'sample' OR ${t.templateId} IS NOT NULL`),
  check("sync_job_runs_schedule_check", sql`(${t.triggerType} = 'scheduled') = (${t.scheduledAt} IS NOT NULL)`),
  unique("sync_job_runs_template_schedule_key").on(t.templateId, t.scheduledAt),
  check("sync_job_runs_result_summary_check", sql`jsonb_typeof(${t.resultSummary}) = 'object'`),
  index("sync_job_runs_recent_idx").on(t.createdAt.desc(), t.id.desc()),
  foreignKey({ columns: [t.retryOf], foreignColumns: [t.id], name: "sync_job_runs_retry_of_fkey" }),
  unique("sync_job_runs_retry_of_key").on(t.retryOf),
  check("sync_job_runs_retry_of_check", sql`${t.retryOf} is null or (${t.retryOf} <> ${t.id} and ${t.triggerType} = 'manual')`),
])

export const syncRunItems = pgTable("sync_run_items", {
  runId: uuid("run_id").notNull().references(() => syncJobRuns.id),
  tmdbId: bigint("tmdb_id", { mode: "bigint" }).notNull(),
  position: integer("position").notNull(),
  status: text("status", { enum: ["pending", "fetched", "stored", "unchanged", "removed", "failed", "deferred"] }).notNull().default("pending"),
  fetchedAt: instant("fetched_at"),
  errorCode: text("error_code"),
}, (t) => [
  primaryKey({ columns: [t.runId, t.tmdbId], name: "sync_run_items_pkey" }),
  unique("sync_run_items_run_id_position_key").on(t.runId, t.position),
  check("sync_run_items_tmdb_id_check", sql`${t.tmdbId} > 0`),
  check("sync_run_items_position_check", sql`${t.position} >= 1`),
  check("sync_run_items_status_check", sql`${t.status} in ('pending','fetched','stored','unchanged','removed','failed','deferred')`),
  check("sync_run_items_check", sql`(${t.fetchedAt} is not null) = (${t.status} in ('fetched','stored','unchanged','removed'))`),
  check("sync_run_items_check1", sql`(${t.errorCode} is not null) = (${t.status} in ('failed','deferred'))`),
])

export const adminAuditEvents = pgTable("admin_audit_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorGithubId: text("actor_github_id").notNull(),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id"),
  outcome: text("outcome", { enum: ["succeeded", "failed", "denied"] }).notNull(),
  createdAt: instant("created_at").notNull().defaultNow(),
}, (t) => [
  check("admin_audit_events_actor_github_id_check", sql`${t.actorGithubId} ~ '^[1-9][0-9]*$'`),
  check("admin_audit_events_action_check", sql`btrim(${t.action}) <> ''`),
  check("admin_audit_events_target_type_check", sql`btrim(${t.targetType}) <> ''`),
  check("admin_audit_events_outcome_check", sql`${t.outcome} IN ('succeeded', 'failed', 'denied')`),
])
