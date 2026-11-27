// 只在开发者主动运行此脚本时启动；不导入生产路由、凭据或数据库。
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { confirmation, episodeDetail, locale, normalizeTitle, searchId, searchParams, searchResult, seriesDetail } from '../src/lib/consumer/tv-contract';

const rows = ['2023','2025'].map((year,i)=>({seriesId:String(910001+i),name:'星港档案',originalName:`Star Harbour ${year}`,firstAirDate:`${year}-01-01`,overview:'合成联调数据。'}));
export function fixtureServer() {
  const seen = new Set<string>();
  const sessions = new Map<string,{key:string; shown:Set<string>; selected?:string}>();
  const cache = (key:string) => { const hit=seen.has(key); seen.add(key); return hit?'hit':'refreshed'; };
  return createServer(async(req,res)=>{
    const send=(status:number,body:unknown)=>{ res.writeHead(status,{'content-type':'application/json','cache-control':'no-store',...(status===401?{'www-authenticate':'Bearer'}:{})});res.end(JSON.stringify(body)); };
    const error=(status:number,code:string)=>send(status,{error:code});
    if(req.headers.authorization!=='Bearer vidall-local-fixture')return error(401,'unauthorized');
    const {pathname,searchParams:q}=new URL(req.url??'/', 'http://localhost');
    try {
      if(req.method==='GET'&&pathname==='/api/v1/search/tv') {
        const sid=searchId.safeParse(req.headers['x-search-id']);
        const parsed=searchParams.safeParse({query:normalizeTitle(q.get('query')??''),lang:q.get('lang')??undefined,first_air_date_year:q.has('first_air_date_year')?Number(q.get('first_air_date_year')):undefined,page:q.has('page')?Number(q.get('page')):undefined});
        if(!sid.success||!parsed.success)return error(400,'invalid_request');
        const {query,lang,first_air_date_year:year,page}=parsed.data;
        const key=JSON.stringify([query,lang,year]);const session=sessions.get(sid.data)??{key,shown:new Set<string>()};
        if(session.key!==key)return error(409,'conflict');
        const matches=rows.filter(r=>(r.name.includes(query)||r.originalName.toLowerCase().includes(query.toLowerCase()))&&(!year||r.firstAirDate.startsWith(String(year))));
        // 每页一个候选，方便下游测试翻页、歧义与候选确认。
        const results=matches.slice(page-1,page); for(const row of results)session.shown.add(row.seriesId);
        sessions.set(sid.data,session);
        return send(200,searchResult.parse({searchId:sid.data,locale:lang,cache:cache(key+':'+page),page,totalPages:matches.length,totalResults:matches.length,results}));
      }
      if(req.method==='POST'&&pathname==='/api/v1/search/tv/confirm') {
        let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>2048)return error(400,'invalid_request');}
        const {searchId:id,seriesId}=confirmation.parse(JSON.parse(raw));const s=sessions.get(id);
        if(!s)return error(404,'not_found');
        if(!s.shown.has(seriesId)||(s.selected&&s.selected!==seriesId))return error(409,'conflict');
        s.selected=seriesId;return send(200,{searchId:id,seriesId});
      }
      const path=/^\/api\/v1\/tv\/([1-9]\d*)(?:\/season\/(0|[1-9]\d*)\/episode\/([1-9]\d*))?$/.exec(pathname);
      if(req.method!=='GET'||!path)return error(404,'not_found');
      const lang=locale.parse(q.get('lang')??'zh-CN');const row=rows.find(r=>r.seriesId===path[1]);if(!row)return error(404,'not_found');
      const seasons=[{seasonNumber:0,name:'特别篇',episodeCount:1},{seasonNumber:1,name:'第一季',episodeCount:6}];
      if(!path[2])return send(200,seriesDetail.parse({...row,seasons,locale:lang,cache:cache(pathname+lang)}));
      const seasonNumber=Number(path[2]),episodeNumber=Number(path[3]);if(!seasons.some(s=>s.seasonNumber===seasonNumber&&episodeNumber<=s.episodeCount))return error(404,'not_found');
      return send(200,episodeDetail.parse({seriesId:row.seriesId,seasonNumber,episodeNumber,name:`联调第 ${episodeNumber} 集`,overview:null,airDate:null,locale:lang,cache:cache(pathname+lang)}));
    } catch { return error(400,'invalid_request'); }
  });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  fixtureServer().listen(4317,'127.0.0.1',()=>console.log('VidAll TV 本地合成服务：http://127.0.0.1:4317（Ctrl+C 停止）'));
}
