import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { fixtureServer } from '../scripts/tv-relay-fixture';
import { tvPreviewContract, episodeDetail, searchResult, seriesDetail } from '../src/lib/consumer/tv-contract';

test('VidAll 从同名剧候选到单集详情：HTTP 契约与缓存',async t=>{
  assert.deepEqual(JSON.parse(readFileSync('openspec/contracts/tv-relay-preview.openapi.json','utf8')),tvPreviewContract);
  const s=fixtureServer().listen(0,'127.0.0.1'); await once(s,'listening');t.after(()=>new Promise<void>(resolve=>s.close(()=>resolve())));
  const base='http://127.0.0.1:'+(s.address() as AddressInfo).port+'/api/v1';
  const id=crypto.randomUUID(), headers={Authorization:'Bearer vidall-local-fixture','X-Search-Id':id};
  const get=(p:string)=>fetch(base+p,{headers});const search='/search/tv?query='+encodeURIComponent('星港档案');
  const pick=(seriesId:string)=>fetch(base+'/search/tv/confirm',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({searchId:id,seriesId})});
  assert.equal((await fetch(base+search)).status,401);
  assert.equal((await get('/search/tv')).status,400);
  const a=searchResult.parse(await (await get(search)).json());assert.equal(a.totalResults,2);assert.equal(a.cache,'refreshed');
  assert.equal((await (await get(search)).json()).cache,'hit');assert.equal((await get(search+'&first_air_date_year=2025')).status,409);
  assert.equal((await pick('910002')).status,409);await get(search+'&page=2');
  for(let i=0;i<2;i++)assert.equal((await pick('910002')).status,200);assert.equal((await pick('910001')).status,409);
  assert.equal(seriesDetail.parse(await (await get('/tv/910002')).json()).seasons[0].seasonNumber,0);
  const episode='/tv/910002/season/1/episode/5';for(const cache of ['refreshed','hit'])assert.equal(episodeDetail.parse(await (await get(episode)).json()).cache,cache);
  assert.equal((await get('/tv/910002/season/0/episode/1')).status,200);assert.equal((await get('/tv/910002/season/1/episode/7')).status,404);
});
