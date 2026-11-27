import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import type { WriteDb } from "./sync-runs";
import { TmdbRequestError } from "@/lib/tmdb/movie-client";

export async function withTmdbPermit<T>(db: WriteDb, work: () => Promise<T>, background = false): Promise<T> {
  const token = randomUUID();
  const { rows } = await db.execute(sql`
    update public.tmdb_request_gate
    set lease_token = ${token}::uuid, lease_until = now() + interval '15 seconds',
        request_count = (case when hour_start = date_trunc('hour',now(),'UTC') then request_count else 0 end) + 1,
        hour_start = date_trunc('hour',now(),'UTC')
    where id and (lease_until is null or lease_until <= now())
      and (cooldown_until is null or cooldown_until <= now())
      and (hour_start <> date_trunc('hour',now(),'UTC') or request_count < ${background ? 480 : 600})
    returning id`);
  if (!rows.length) {
    const state = await db.execute(sql`select greatest(now() + interval '2 seconds', cooldown_until, lease_until,
      case when hour_start = date_trunc('hour',now(),'UTC') and request_count >= 600 then hour_start + interval '1 hour' end
      )::text as retry_at from public.tmdb_request_gate where id`);
    const at = state.rows[0]?.retry_at;
    throw new TmdbRequestError("budget_unavailable", typeof at === "string" ? new Date(at).toISOString() : null);
  }

  let coolUntil: string | null = null;
  try {
    return await work();
  } catch (error) {
    if (error instanceof TmdbRequestError && error.code === "rate_limited") coolUntil = error.retryAt;
    throw error;
  } finally {
    // Always allow a genuine 429 to extend the shared cooldown, but a stale
    // holder must never release a lease acquired by a different instance.
    await db.execute(sql`update public.tmdb_request_gate
      set lease_token = case when lease_token = ${token}::uuid then null else lease_token end,
          lease_until = case when lease_token = ${token}::uuid then null else lease_until end,
          cooldown_until = greatest(cooldown_until,${coolUntil}::timestamptz)
      where id and (lease_token = ${token}::uuid or ${coolUntil}::timestamptz is not null)`);
  }
}
