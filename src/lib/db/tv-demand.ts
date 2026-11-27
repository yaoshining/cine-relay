import { sql } from 'drizzle-orm';
import { locale, seriesId } from '../consumer/tv-contract';
import type { tvClient } from '../tmdb/tv-client';
import { cachedTv } from './tv-relay';
import type { WriteDb } from './sync-runs';

// Confirmations are the durable work list: grouping deduplicates by show/locale;
// cachedTv fences workers against foreground refreshes and marks completed work fresh.
export async function topConfirmed(db:WriteDb) {
  return (await db.execute(sql`select selected as id, conditions->>'lang' as lang, count(*)::int as confirmations from public.tv_search_operations where confirmed_at>now()-interval '24 hours' group by selected,conditions->>'lang' having count(*)>=3 order by count(*) desc,max(confirmed_at) desc,selected,conditions->>'lang' limit 10`)).rows;
}
export async function demandStats(db:WriteDb){return {
  queries:(await db.execute(sql`select conditions,count(*)::int as searches from public.tv_search_operations where created_at>now()-interval '24 hours' group by conditions order by count(*) desc,conditions limit 100`)).rows,
  confirmed:(await db.execute(sql`select selected as id,conditions->>'lang' as lang,count(*)::int as confirmations from public.tv_search_operations where confirmed_at>now()-interval '24 hours' group by selected,conditions->>'lang' order by count(*) desc,selected,conditions->>'lang' limit 100`)).rows,
};}
export async function maintainTv(db:WriteDb,client?:()=>ReturnType<typeof tvClient>){
  await db.execute(sql`delete from public.tv_search_operations where (consumer_id,search_id) in (select consumer_id,search_id from public.tv_search_operations where greatest(created_at,confirmed_at)<now()-interval '24 hours' limit 500)`);
  await db.execute(sql`delete from public.tv_cache where resource in (select resource from public.tv_cache where purge_after<=now() and (lease_until is null or lease_until<=now()) limit 500) and purge_after<=now() and (lease_until is null or lease_until<=now())`);
  if (!client) return {status:'cleaned'};
  for(const row of await topConfirmed(db)){
    const id=seriesId.parse(row.id),lang=locale.parse(row.lang);
    const r=await cachedTv(db,JSON.stringify(['series',id,lang]),()=>client().series(id,lang),()=>604800,true);
    if(r.cache!=='hit')return {status:r.cache};
  }
  return {status:'idle'};
}
