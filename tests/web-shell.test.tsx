import assert from 'node:assert/strict';
import { accessSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import Overview from '../src/app/(admin)/view';
import Jobs from '../src/app/(admin)/jobs/view';
import Credentials from '../src/app/(admin)/credentials/view';
import { LoginView } from '../src/app/login/view';
import NewJob from '../src/app/(admin)/jobs/new/view';
import EditJob from '../src/app/(admin)/jobs/[id]/view';
import Runs from '../src/app/(admin)/runs/view';
import RunDetail from '../src/app/(admin)/runs/[id]/view';
import Consumers from '../src/app/(admin)/consumers/view';
import { AuditLog } from '../src/components/audit-log';
import { Catalog } from '../src/components/catalog';
import MovieDetail from '../src/app/(admin)/movies/[id]/view';
import { completion, filterMovies, movies, navigation } from '../src/lib/demo';

test('dashboard is a labelled offline demo and renders six local poster links', () => {
  const markup = renderToStaticMarkup(<Overview/>);
  assert.match(markup,/1\.1 视觉骨架/);
  assert.match(markup,/不连接 Neon \/ TMDB/);
  assert.match(markup,new RegExp(`${completion}%`));
  assert.match(markup,/缓存命中率/);
  assert.match(markup,/href="\/docs\/api"/);
  assert.equal((markup.match(/class="poster-link"/g)??[]).length,6);
  for(const m of movies.slice(0,6)) assert.ok(markup.includes(`/movies/${m.id}`));
  assert.doesNotMatch(markup,/\b(?:href|src|action)="https?:\/\//);
});

test('each navigation route is unique and has its own App Router page', () => {
  assert.equal(new Set(navigation.map(([href])=>href)).size,8);
  for(const [href] of navigation) accessSync(`src/app${href==="/docs/api"?"":"/(admin)"}${href==="/"?"":href}/page.tsx`);
});

test('offline catalog finds case-insensitive titles and respects status filters', () => {
  assert.equal(filterMovies(' #920101 ')[0].title,'海街晨光');
  assert.equal(filterMovies('ECHOES').length,2);
  assert.equal(filterMovies('沙海','新鲜').length,0);
  assert.equal(filterMovies('','已过期')[0].id,'823338');
  assert.equal(filterMovies('missing').length,0);
});

test('catalog shows ten synthetic posters while the movie detail reports its own cache state', async () => {
  const catalog=renderToStaticMarkup(<Catalog initialQuery=""/>);
  assert.equal((catalog.match(/class="poster-link"/g)??[]).length,10);
  assert.equal(filterMovies('', 'all', 'recent', 'en-US').length,0);
  assert.equal(new Set(movies.map(({overview})=>overview)).size,10);
  const detail=renderToStaticMarkup(await MovieDetail({params:Promise.resolve({id:'438631'})}));
  assert.match(detail,/深空观测站/);
  assert.match(detail,/data-type="boolean">false/);
  assert.match(detail,/data-fresh="true"/);
});

test('jobs with sample results and credentials each show one solid primary action', async () => {
  const jobs = renderToStaticMarkup(await Jobs({searchParams:Promise.resolve({sample:'1'})}));
  const credentials = renderToStaticMarkup(<Credentials/>);
  for (const markup of [jobs, credentials]) {
    assert.equal((markup.match(/data-slot="button" data-variant="default"/g)??[]).length,1);
    assert.equal((markup.match(/data-slot="button" data-variant="indigo-outline"/g)??[]).length,1);
  }
});

test('confirmed console views have their own routes and primary action hierarchy', async () => {
  const searchParams=Promise.resolve({});
  const views = [
    [renderToStaticMarkup(<LoginView enabled signIn={async () => {}}/>),/使用 GitHub 受邀账户登录/,1],
    [renderToStaticMarkup(await Jobs({searchParams})),/href="\/jobs\/daily\?sample=1"/,1],
    [renderToStaticMarkup(await NewJob({searchParams})),/返回任务配置/,1],
    [renderToStaticMarkup(await EditJob({params:Promise.resolve({id:'weekly'}),searchParams})),/每周经典片单增量/,1],
    [renderToStaticMarkup(await Jobs({searchParams:Promise.resolve({sample:'1'})})),/SAMPLE #0023/,1],
    [renderToStaticMarkup(<Runs/>),/href="\/runs\/0142"/,1],
    [renderToStaticMarkup(await RunDetail({params:Promise.resolve({id:'0142'})})),/返回运行历史/,1],
    [renderToStaticMarkup(<Consumers/>),/vidall-stg-4p9x/,1],
    [renderToStaticMarkup(<AuditLog events={[]} asOf={0}/>),/只读审计流/,0],
  ] as const;
  for(const [markup,expected,count] of views){
    assert.match(markup,expected);
    assert.equal((markup.match(/data-slot="button" data-variant="default"/g)??[]).length,count);
  }
  await assert.rejects(RunDetail({params:Promise.resolve({id:'unknown'})}),{digest:'NEXT_HTTP_ERROR_FALLBACK;404'});
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
