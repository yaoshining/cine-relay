import { sql } from "drizzle-orm";
import type { TmdbErrorCode } from "@/lib/tmdb/movie-client";
import { changeId, type WriteDb } from "./sync-runs";

type Health = Exclude<TmdbErrorCode, "budget_unavailable"> | "credential_unreadable";

export function addTmdbCredential(db: WriteDb, id: string, name: string, encrypted: string, actor: string) {
  return changeId(db, sql`with changed as (
    insert into public.tmdb_credentials (id,name,encrypted_token) values (${id}::uuid,${name},${encrypted}) returning id
  ), audit as (
    insert into public.admin_audit_events (actor_github_id,action,target_type,target_id,outcome)
    select ${actor},'tmdb.credential.added','tmdb_credential',id::text,'succeeded' from changed
  ) select id from changed`);
}

export function setTmdbCredentialEnabled(db: WriteDb, id: string, enabled: boolean, actor: string) {
  return changeId(db, sql`with changed as (
    update public.tmdb_credentials set enabled = ${enabled}::boolean, last_error = case when ${enabled} then null else last_error end
    where id = ${id}::uuid and enabled is distinct from ${enabled}::boolean returning id
  ), audit as (
    insert into public.admin_audit_events (actor_github_id,action,target_type,target_id,outcome)
    select ${actor},${enabled ? "tmdb.credential.enabled" : "tmdb.credential.disabled"},'tmdb_credential',id::text,'succeeded' from changed
  ) select id from changed`);
}

export async function nextTmdbCredential(db: WriteDb) {
  const { rows } = await db.execute(sql`select id,encrypted_token from public.tmdb_credentials
    where enabled and (last_error is null or last_error not in ('unauthorized','credential_unreadable')) order by created_at,id limit 1`);
  return (rows[0] as { id: string; encrypted_token: string } | undefined) ?? null;
}

export async function noteTmdbCredential(db: WriteDb, id: string, error: Health | null) {
  await db.execute(sql`update public.tmdb_credentials set last_error = ${error}::text,last_checked_at=now() where id=${id}::uuid and enabled`);
}

export async function readTmdbPool(db: WriteDb) {
  const [keys, gate] = await Promise.all([
    db.execute(sql`select id,name,enabled,last_error,last_checked_at::text from public.tmdb_credentials order by created_at desc,id desc limit 100`),
    db.execute(sql`select cooldown_until::text, (cooldown_until > now()) as cooling,
      case when hour_start=date_trunc('hour',now(),'UTC') then request_count else 0 end as request_count from public.tmdb_request_gate where id`),
  ]);
  return {
    keys: keys.rows as { id: string; name: string; enabled: boolean; last_error: Health | null; last_checked_at: string | null }[],
    gate: gate.rows[0] as { cooldown_until: string | null; cooling: boolean | null; request_count: number } | undefined,
  };
}
