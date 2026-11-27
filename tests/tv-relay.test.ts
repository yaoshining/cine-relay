import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {drizzle} from 'drizzle-orm/pglite';
import {issueConsumerKey} from '../src/lib/db/consumer-keys';
import {tvApi,type TvAction} from '../src/lib/consumer/tv-api';
import {tvClient} from '../src/lib/tmdb/tv-client';
import {TmdbRequestError} from '../src/lib/tmdb/movie-client';
import {demandStats,maintainTv} from '../src/lib/db/tv-demand';
import {withTmdbPermit} from '../src/lib/db/tmdb-gate';

test('真实 SQL：搜索、确认归属、并发、近期热度、共享额度、单集缓存隔离',async t=>{
  const pg=new PGlite();t.after(()=>pg.close());for(const f of (await readdir('db/migrations')).filter(x=>x.endsWith('.sql')).sort())await pg.exec(await readFile('db/migrations/'+f,'utf8'));
  const db=drizzle(pg),key=(await issueConsumerKey(db,'合成测试','11'))!,other=(await issueConsumerKey(db,'其他测试','12'))!;
  const show={id:101,name:'星港',original_name:'Star Port',first_air_date:'2023-01-01',overview:'合成数据'};
  let searches=0,series=0,episodes=0,empty=false,rate=false;
  let release!:()=>void; const held=new Promise<void>(r=>release=r);let entered!:()=>void;const calling=new Promise<void>(r=>entered=r);
  const client=tvClient(async(path,p)=>{
    if(path==='/search/tv'){assert.equal(p.get('include_adult'),'false');searches++;if(rate)throw new TmdbRequestError('rate_limited');if(searches===1){entered();await held;}return {page:1,total_pages:empty?0:1,total_results:empty?0:1,results:empty?[]:[show]};}
    if(path==='/tv/101'){series++;return {...show,seasons:[{season_number:1,name:'第一季',episode_count:6}]};}
    if(path==='/tv/101/season/0/episode/1'){episodes++;return {season_number:0,episode_number:1,name:'特别篇'};}
    throw new TmdbRequestError('not_found');});
  const ask=(a:TvAction,id:string,q='',body?:unknown,token=key.token,params:Record<string,string>={})=>tvApi(new Request('http://localhost/'+q,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,'X-Search-Id':id},body:body?JSON.stringify(body):undefined}),a,params,()=>db,()=>client);
  const id=crypto.randomUUID(),q='?query=星港';const first=ask('search',id,q);await calling;assert.equal((await ask('search',id,q)).status,503);release();assert.equal((await (await first).json()).cache,'refreshed');
  assert.equal((await (await ask('search',id,q)).json()).cache,'hit');assert.equal(searches,1);
  assert.equal((await ask('confirm',id,'',{searchId:id,seriesId:'101'},other.token)).status,404);
  for(const sid of [id,crypto.randomUUID(),crypto.randomUUID()]){await ask('search',sid,q);for(let i=0;i<2;i++)assert.equal((await ask('confirm',sid,'',{searchId:sid,seriesId:'101'})).status,200);}
  assert.equal((await ask('confirm',id,'',{searchId:id,seriesId:'102'})).status,409);
  const stats=await demandStats(db);assert.equal(stats.queries[0].searches,3);assert.equal(stats.confirmed[0].confirmations,3);
  assert.deepEqual(await maintainTv(db,()=>client),{status:'refreshed'});assert.deepEqual(await maintainTv(db,()=>client),{status:'idle'});assert.equal(series,1);assert.equal(episodes,0);
  const ep={seriesId:'101',season:'0',episode:'1'};for(const c of ['refreshed','hit'])assert.equal((await (await ask('episode',id,'',undefined,key.token,ep)).json()).cache,c);assert.equal(episodes,1);
  rate=true;assert.equal((await ask('search',crypto.randomUUID(),'?query=空')).status,503);rate=false;empty=true;
  assert.equal((await (await ask('search',crypto.randomUUID(),'?query=空')).json()).totalResults,0);
  const {rows}=await pg.query<{ttl:number}>("select extract(epoch from expires_at-now())::int as ttl from tv_cache where payload->>'totalResults'='0'");assert.ok(rows[0].ttl>595&&rows[0].ttl<=600);
  await pg.exec('update tmdb_request_gate set request_count=480');await assert.rejects(withTmdbPermit(db,async()=>1,true),/budget_unavailable/);assert.equal(await withTmdbPermit(db,async()=>1),1);
  assert.equal((await pg.query('select tmdb_id from movies')).rows.length,0);
});
