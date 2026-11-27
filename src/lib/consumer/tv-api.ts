import { z } from 'zod';
import { consumerIdentity } from '../db/consumer-keys';
import { admitTvRequest, cachedTv, recordTvSearch, confirmTv, TvConflict } from '../db/tv-relay';
import type { WriteDb } from '../db/sync-runs';
import { TmdbRequestError } from '../tmdb/movie-client';
import type { tvClient } from '../tmdb/tv-client';
import { confirmation, locale, normalizeTitle, searchId, searchParams, seriesId } from './tv-contract';

const headers={'Cache-Control':'private, no-store'};
function fail(status:number,error:string,extra:Record<string,string>={}){return Response.json({error},{status,headers:{...headers,...extra}});}
function integer(raw:string|null){return raw===null?undefined:/^(0|[1-9]\d*)$/.test(raw)?Number(raw):NaN;}
export type TvAction = 'search'|'confirm'|'series'|'episode';
export async function tvApi(request:Request,action:TvAction,params:Record<string,string>,database:()=>WriteDb,upstream:()=>ReturnType<typeof tvClient>){
  try{
    const auth=request.headers.get('authorization');if(!auth)return fail(401,'unauthorized',{'WWW-Authenticate':'Bearer'});
    const db=database(),consumer=await consumerIdentity(db,auth);if(!consumer)return fail(401,'unauthorized',{'WWW-Authenticate':'Bearer'});
    if(!await admitTvRequest(db,consumer))return fail(429,'rate_limited',{'Retry-After':'60'});
    const q=new URL(request.url).searchParams;
    for(const name of q.keys())if(q.getAll(name).length!==1||!(action==='search'?['lang','query','first_air_date_year','page']:action==='confirm'?[]:['lang']).includes(name))return fail(400,'invalid_request');
    const lang=locale.parse(q.get('lang')??'zh-CN');
    if(action==='search'){
      const id=searchId.parse(request.headers.get('x-search-id'));
      const s=searchParams.parse({query:normalizeTitle(q.get('query')??''),lang,first_air_date_year:integer(q.get('first_air_date_year')),page:integer(q.get('page'))});
      if(s.query.includes('\0'))return fail(400,'invalid_request');
      const {page,...conditions}=s;
      const r=await cachedTv(db,JSON.stringify(['search',conditions,page]),()=>upstream().search(s),d=>d.results.length?86400:600,false);
      await recordTvSearch(db,consumer,id,conditions,r.data.results.map(x=>x.seriesId));
      return Response.json({...r.data,searchId:id,cache:r.cache},{headers});
    }
    if(action==='confirm'){
      // Cap the small public JSON body even without Content-Length.
      const reader=request.body?.getReader();if(!reader)return fail(400,'invalid_request');
      const chunks:Uint8Array[]=[];let n=0;for(;;){const {done,value}=await reader.read();if(done)break;n+=value.length;if(n>2048){await reader.cancel();return fail(400,'invalid_request');}chunks.push(value);}
      let input:unknown;try{input=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return fail(400,'invalid_request');}
      const pair=confirmation.parse(input);await confirmTv(db,consumer,pair.searchId,pair.seriesId);return Response.json(pair,{headers});
    }
    const id=seriesId.parse(params.seriesId);
    if(action==='series'){
      const r=await cachedTv(db,JSON.stringify(['series',id,lang]),()=>upstream().series(id,lang),()=>604800,true);
      return Response.json({...r.data,cache:r.cache},{headers});
    }
    const s=z.int().nonnegative().parse(integer(params.season)),e=z.int().positive().parse(integer(params.episode));
    const r=await cachedTv(db,JSON.stringify(['episode',id,s,e,lang]),()=>upstream().episode(id,s,e,lang),()=>604800,true);return Response.json({...r.data,cache:r.cache},{headers});
  }catch(err){if(err instanceof z.ZodError)return fail(400,'invalid_request');if(err instanceof TvConflict)return fail(409,'conflict');if(err instanceof TmdbRequestError&&err.code==='not_found')return fail(404,'not_found');const retry=err instanceof TmdbRequestError&&err.retryAt?Math.max(1,Math.ceil((Date.parse(err.retryAt)-Date.now())/1000)):5;return fail(503,'unavailable',{'Retry-After':String(retry)});}
}
