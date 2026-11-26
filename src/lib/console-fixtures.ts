export const templates = [
 {id:'daily',name:'每日电影增量',mode:'incremental',scope:'2026 · 剧情 / 科幻 · zh-CN',schedule:'每日 09:00 CST',cursor:'2026-11-26 08:00',enabled:true,run:'0142',status:'运行中',year:'2026',genre:'drama'},
 {id:'weekly',name:'每周经典片单增量',mode:'incremental',scope:'2015–2025 · 全部类别 · zh-CN',schedule:'每周日 03:00 CST',cursor:'2026-11-22 03:00',enabled:true,run:'0139',status:'已完成',year:'2025',genre:'all'},
 {id:'backfill',name:'2026 院线热门回填',mode:'once',scope:'2026 · 全部类别 · zh-CN / en-US',schedule:'手动触发 · 上限 250 部',cursor:'不适用',enabled:false,run:'0136',status:'已完成 · 250/250',year:'2026',genre:'all'},
 {id:'anime',name:'日语动画专项补齐',mode:'incremental',scope:'2020–2026 · 动画 · 原片 ja → zh-CN',schedule:'未安排 · 待处理',cursor:'待重建',enabled:false,warning:true,year:'2026',genre:'animation'},
] as const;

export type RunState='running'|'sample'|'partial'|'dispatch'|'complete';
export type Run={id:string;name:string;mode:string;trigger:string;planned:string;actual:string;counts:readonly [number,number,number,number];status:RunState};
export const runStatus={running:'运行中 · 2 失败',sample:'试抓 · 未写库',partial:'部分失败 (2)',dispatch:'派发失败 · 可重派',complete:'已完成'} as const;
const primaryRuns: Run[] = [
 {id:'0142',name:'每日电影增量',mode:'增量同步',trigger:'定时计划',planned:'09:00',actual:'09:02',counts:[1280,1280,1246,1240],status:'running'},
 {id:'sample-0023',name:'2026 院线热门回填',mode:'试抓样本',trigger:'手动试抓',planned:'—',actual:'08:45',counts:[0,0,0,0],status:'sample'},
 {id:'0141',name:'每日电影增量',mode:'增量同步',trigger:'定时计划',planned:'昨日 09:00',actual:'09:00',counts:[412,412,412,410],status:'partial'},
 {id:'0140',name:'每日电影增量',mode:'增量同步',trigger:'定时计划',planned:'11-24 09:00',actual:'待派发',counts:[0,0,0,0],status:'dispatch'},
 {id:'0139',name:'每周经典片单增量',mode:'增量同步',trigger:'定时计划',planned:'11-22 03:00',actual:'03:01',counts:[680,680,680,680],status:'complete'},
 {id:'0136',name:'2026 院线热门回填',mode:'一次性回填',trigger:'手动立即',planned:'—',actual:'11-21 21:14',counts:[250,250,250,250],status:'complete'},
];
export const runs:Run[]=[...primaryRuns,...Array.from({length:12},(_,i):Run=>{
 const count=120+i*8, sample=i>=10;
 return {id:sample?`sample-00${32-i}`:String(135-i).padStart(4,'0'),name:sample?'2026 院线热门回填':'每日电影增量',mode:sample?'试抓样本':'增量同步',trigger:sample?'手动试抓':'定时计划',planned:sample?'—':`11-${20-i} 09:00`,actual:sample?`11-${20-i} 08:45`:'09:00',counts:sample?[0,0,0,0]:[count,count,count,count],status:sample?'sample':'complete'};
})];
export const runLabel=(id:string)=>id.startsWith('sample-')?`SAMPLE #${id.slice(7)}`:`#${id}`;

const auditBase = [
 ['11-26 09:18:42','github:18492031','外部应用','撤销外部凭据','vidall-old-3x9p','例行密钥轮换',true],
 ['11-26 09:04:11','github:18492031','任务执行','安全重试失败项','Run #0142 · #920188','幂等入队 · 仅更新更晚 fetched_at',true],
 ['11-26 08:52:05','github:18492031','TMDB 凭据','启用备用凭据','tmdb_••••_4c81','共享并发预算保持 2/2',true],
 ['11-26 08:45:19','github:18492031','任务配置','发起试抓','SAMPLE #0023','最多 5 部 · 不写库 · 不推进游标',true],
 ['11-25 22:31:08','外部密钥 vidall-prod','访问拦截','尝试访问管理接口','/api/admin/runs','外部密钥禁止进入管理后台',false],
 ['11-25 21:10:44','github:99401288','管理员访问','GitHub OAuth 登录校验','GitHub 账户 ID','账户 ID 不在受邀白名单',false],
 ['11-25 18:16:02','github:18492031','外部应用','签发外部凭据','vidall-prod-8k2m','仅存哈希 · 明文单次展示',true],
] as const;
export const auditEvents = Array.from({length:6},(_,group)=>auditBase.map(([time,actor,category,action,target,summary,ok],i)=>({
 time:`2026-${group===0?time:`11-${String(25-group).padStart(2,'0')} ${String(20-i).padStart(2,'0')}:18:42`}`,actor,category,action,target,summary,ok,
}))).flat();
