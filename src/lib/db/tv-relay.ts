import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { TmdbRequestError } from '../tmdb/movie-client';
import type { WriteDb } from './sync-runs';

// One bounded rate window per credential, including cache hits and invalid requests.
export async function admitTvRequest(db: WriteDb, consumer: string) {
  const result = await db.execute(sql`insert into public.tv_request_windows as w(consumer_id,minute,requests)
    values(${consumer}::uuid,date_trunc('minute',now()),1) on conflict(consumer_id) do update set
    minute=excluded.minute,requests=case when w.minute=excluded.minute then w.requests+1 else 1 end
    where w.minute<>excluded.minute or w.requests<120 returning consumer_id`);
  return result.rows.length > 0;
}
export class TvConflict extends Error {}
export async function cachedTv<T extends object>(db:WriteDb, resource:string, load:()=>Promise<T>, ttl:(data:T)=>number, allowStale:boolean) {
  async function read(){const {rows}=await db.execute(sql`select payload, expires_at>now() as fresh, purge_after>now() as retained from public.tv_cache where resource=${resource}`);return rows[0];}
  const cached=await read();
  if(cached?.fresh)return {data:cached.payload as T,cache:'hit' as const};
  const token=randomUUID();
  const lock=await db.execute(sql`insert into public.tv_cache as c(resource,purge_after,lease,lease_until) values(${resource},now()+interval '20 seconds',${token}::uuid,now()+interval '20 seconds') on conflict(resource) do update set lease=excluded.lease,lease_until=excluded.lease_until where (c.lease_until is null or c.lease_until<=now()) and (c.expires_at is null or c.expires_at<=now()) returning resource`);
  async function fallback(err:TmdbRequestError){const r=await read();if(r?.fresh)return {data:r.payload as T,cache:'hit' as const};if(allowStale&&r?.retained&&r.payload)return {data:r.payload as T,cache:'stale' as const};throw err;}
  if(!lock.rows.length)return fallback(new TmdbRequestError('budget_unavailable'));
  try{
    const data=await load(),seconds=ttl(data);
    const stored=await db.execute(sql`update public.tv_cache set payload=${JSON.stringify(data)}::jsonb,expires_at=now()+${seconds}::int*interval '1 second',purge_after=now()+${allowStale?2592000:seconds}::int*interval '1 second',lease=null,lease_until=null where resource=${resource} and lease=${token}::uuid and lease_until>now() returning resource`);
    if(!stored.rows.length)return fallback(new TmdbRequestError('budget_unavailable'));
    return {data,cache:'refreshed' as const};
  }catch(err){if(err instanceof TmdbRequestError && err.code!=='not_found')return fallback(err);throw err;}
  finally {await Promise.resolve(db.execute(sql`update public.tv_cache set lease=null,lease_until=null where resource=${resource} and lease=${token}::uuid`)).catch(()=>{});}
}

export async function recordTvSearch(db:WriteDb, consumer:string,id:string,conditions:object,ids:string[]){
  const shown=Object.fromEntries(ids.map(i=>[i,true]));
  const r=await db.execute(sql`insert into public.tv_search_operations as s(consumer_id,search_id,conditions,shown) values(${consumer}::uuid,${id}::uuid,${JSON.stringify(conditions)}::jsonb,${JSON.stringify(shown)}::jsonb) on conflict(consumer_id,search_id) do update set shown=s.shown||excluded.shown where s.conditions=excluded.conditions and s.created_at>now()-interval '24 hours' returning search_id`);
  if(!r.rows.length)throw new TvConflict();
}
export async function confirmTv(db:WriteDb,consumer:string,id:string,series:string){
  const r=await db.execute(sql`update public.tv_search_operations set selected=${series},confirmed_at=coalesce(confirmed_at,now()) where consumer_id=${consumer}::uuid and search_id=${id}::uuid and created_at>now()-interval '24 hours' and shown ? ${series} and (selected is null or selected=${series}) returning search_id`);
  if(!r.rows.length){const op=await db.execute(sql`select search_id from public.tv_search_operations where consumer_id=${consumer}::uuid and search_id=${id}::uuid and created_at>now()-interval '24 hours'`);if(!op.rows.length)throw new TmdbRequestError('not_found');throw new TvConflict();}
}
