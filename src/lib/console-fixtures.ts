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
