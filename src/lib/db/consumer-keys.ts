import { createHash, randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import { changeId, type WriteDb } from "./sync-runs";

const tokenPattern = /^Bearer (cr_live_[A-Za-z0-9_-]{43})$/i;
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function issueConsumerKey(db: WriteDb, name: string, actor: string) {
  const token = "cr_live_" + randomBytes(32).toString("base64url");
  const id = await changeId(db, sql`with changed as (
    insert into public.consumer_keys(name,token_hash) values (${name},${hashToken(token)}) returning id
  ), audit as (
    insert into public.admin_audit_events (actor_github_id,action,target_type,target_id,outcome)
    select ${actor},'consumer.key.issued','consumer_key',id::text,'succeeded' from changed
  ) select id from changed`);
  return id ? { id, token } : null;
}

export function revokeConsumerKey(db: WriteDb, id: string, actor: string) {
  return changeId(db, sql`with changed as (
    update public.consumer_keys set revoked_at = now() where id = ${id}::uuid and revoked_at is null returning id
  ), audit as (
    insert into public.admin_audit_events (actor_github_id,action,target_type,target_id,outcome)
    select ${actor},'consumer.key.revoked','consumer_key',id::text,'succeeded' from changed
  ) select id from changed`);
}

export async function consumerIdentity(db: WriteDb, authorization: string | null) {
  const token = tokenPattern.exec(authorization ?? "")?.[1];
  if (!token) return null;
  return changeId(db, sql`select id from public.consumer_keys where token_hash = ${hashToken(token)} and revoked_at is null`);
}

export async function authorizeConsumer(db: WriteDb, authorization: string | null) {
  return !!await consumerIdentity(db, authorization);
}

export async function listConsumerKeys(db: WriteDb) {
  const { rows } = await db.execute(sql`select id, name, created_at::text, revoked_at::text from public.consumer_keys order by created_at desc,id desc limit 100`);
  return rows as { id: string; name: string; created_at: string; revoked_at: string | null }[];
}
