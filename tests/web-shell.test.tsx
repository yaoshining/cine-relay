import assert from 'node:assert/strict';
import { accessSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import Overview from '../src/app/(admin)/view';
import { LoginView } from '../src/app/login/view';
import { AuditLog } from '../src/components/audit-log';
import { Catalog } from '../src/components/catalog';
import { completion, movies, navigation } from '../src/lib/demo';
import { parseCatalogParams } from '../src/lib/movie-catalog';

test('dashboard is a labelled offline demo and renders six local posters without fake detail links', () => {
  const markup = renderToStaticMarkup(<Overview/>);
  assert.match(markup,/1\.1 视觉骨架/);
  assert.match(markup,/不连接 Neon \/ TMDB/);
  assert.match(markup,new RegExp(`${completion}%`));
  assert.match(markup,/缓存命中率/);
  assert.match(markup,/href="\/docs\/api"/);
  assert.equal((markup.match(/class="poster-link"/g)??[]).length,6);
  for(const m of movies.slice(0,6)) assert.ok(!markup.includes(`/movies/${m.id}`));
  assert.doesNotMatch(markup,/\b(?:href|src|action)="https?:\/\//);
});

test('each navigation route is unique and has its own App Router page', () => {
  assert.equal(new Set(navigation.map(([href])=>href)).size,8);
  for(const [href] of navigation) accessSync(`src/app${href==="/docs/api"?"":"/(admin)"}${href==="/"?"":href}/page.tsx`);
});

test('catalog distinguishes an empty result from a database outage', () => {
  const filters = parseCatalogParams({ q: '不存在' });
  const empty = renderToStaticMarkup(<Catalog filters={filters} result={{ entries: [], hasNext: false }}/>);
  const unavailable = renderToStaticMarkup(<Catalog filters={filters} result={null}/>);
  assert.match(empty, /没有匹配的缓存记录/);
  assert.match(unavailable, /暂时无法读取电影缓存/);
  assert.doesNotMatch(unavailable, /没有匹配的缓存记录|海街晨光/);
});

test('confirmed console views have their own routes and primary action hierarchy', () => {
  const views = [
    [renderToStaticMarkup(<LoginView enabled signIn={async () => {}}/>),/使用 GitHub 受邀账户登录/,1],
    [renderToStaticMarkup(<AuditLog events={[]} asOf={0}/>),/只读审计流/,0],
  ] as const;
  for(const [markup,expected,count] of views){
    assert.match(markup,expected);
    assert.equal((markup.match(/data-slot="button" data-variant="default"/g)??[]).length,count);
  }
});

test('dark theme text and primary action meet normal text contrast', () => {
  const css=readFileSync('src/app/globals.css','utf8');
  const luminance=(token:string)=>{
    const hex=css.match(new RegExp(`--${token}:\\s*#([a-f0-9]{6})\\b`,'i'))?.[1];
    assert.ok(hex,`missing color ${token}`);
    return [0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(c=>c<=0.04045?c/12.92:((c+.055)/1.055)**2.4).reduce((sum,c,i)=>sum+c*[.2126,.7152,.0722][i],0);
  };
  for (const [a,b] of [['foreground','background'],['muted-foreground','card'],['signal','card'],['warning','card'],['destructive','card'],['action','primary-foreground'],['action-hover','primary-foreground']]) {
    const levels=[luminance(a),luminance(b)].sort((x,y)=>x-y);
    assert.ok((levels[1]+.05)/(levels[0]+.05)>=4.5,`${a} on ${b} fails AA`);
  }
});
