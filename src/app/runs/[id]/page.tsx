import Link from 'next/link';
import { notFound } from 'next/navigation';
import { RunBadge } from '@/components/run-history';
import { runLabel, runs } from '@/lib/console-fixtures';
import { number } from '@/lib/demo';
import { ArrowLeft, Clock3, CircleAlert, RefreshCw } from "lucide-react";
import { Callout, DemoStrip, PageHead, Panel, Relay } from "@/components/console";
import { DemoTable } from "@/components/demo-table";
import { DemoButton } from "@/components/static-controls";
import { Badge } from "@/components/ui/badge";

const batch = [
 ["#48","25 条","已完成","已提交","2.84 秒"],["#49","25 条","已完成","已提交","3.12 秒"],["#50","25 条","已完成","已提交","2.96 秒"],["#51","25 条","已完成","提交超时","5.00 秒"],["#52","25 条","退避中","待入库","—"]
];
export function generateStaticParams(){return runs.map(({id})=>({id}));}
export default async function RunDetail({params}:{params:Promise<{id:string}>}){
 const {id}=await params, run=runs.find(r=>r.id===id);
 if(!run)notFound();
 const breadcrumb=<nav aria-label="面包屑" className="breadcrumbs"><Link className="text-link" href="/runs"><ArrowLeft aria-hidden="true"/>返回运行历史</Link><span aria-hidden="true">/</span><span>{run.name} <code>{runLabel(id)}</code></span></nav>;
 if(id!=='0142')return <div className="page-flow">{breadcrumb}<PageHead title={`${run.name} ${runLabel(id)}`} sub={`计划 ${run.planned} · 实际 ${run.actual}`} action={run.status==='dispatch'||run.status==='partial'?<DemoButton primary message="静态演示 · 未提交调度。">{run.status==='dispatch'?'安全重派':'重试失败项'}</DemoButton>:undefined}><RunBadge status={run.status}/></PageHead><DemoStrip>固定运行快照 · 未连接后端</DemoStrip><Panel title={run.status==='sample'?'试抓诊断':'同步阶段进度'}>{run.status==='sample'?<Callout>抽样 5 部 · 成功 4 部 · 失败 1 部 · 写入 0 部</Callout>:<ol className="relay-track">{['已发现','已入队','已抓取','已入库'].map((phase,i)=><li key={phase}><span className="relay-node" data-index={i}/><span>{phase}</span><b>{number(run.counts[i])}</b></li>)}</ol>}</Panel>{run.status==='partial'&&<Panel title="异常与安全重试队列"><Callout warning>部分入库失败 · 2 条待重试</Callout></Panel>}</div>;
 return <div className="page-flow">{breadcrumb}
 <PageHead title="每日电影增量 #0142" sub="计划 09:00 CST · 实际 09:02 CST · 配置快照已锁定" action={<><DemoButton>暂停任务</DemoButton><DemoButton primary><RefreshCw data-icon="inline-start"/>重试失败项（2）</DemoButton></>}><Badge variant="success"><Clock3/>运行中</Badge></PageHead>
 <DemoStrip>固定运行快照 · 不调用 Inngest 或数据库</DemoStrip><Panel title="同步阶段进度 · Inngest 编排"><Relay full/></Panel>
 <div className="split"><Panel title="批次执行记录"><DemoTable label="演示批次" columns={["批次","条数","TMDB 抓取","Neon 入库","耗时"]} rows={batch.map(([id,n,fetch,db,time])=>[<code key="id">{id}</code>,n,<Badge key="f" variant={fetch==="已完成"?"success":"warning"}>{fetch}</Badge>,<Badge key="d" variant={db==="已提交"?"success":"warning"}>{db}</Badge>,<span key="t" className="mono">{time}</span>])}/></Panel>
 <Panel title="异常与安全重试队列"><div className="in-card-stack"><Callout warning><b>429 共享退避 · Retry-After 14 秒</b><small>共享冷却中，不切换凭据绕过限流。</small></Callout>
 {[["#920188","Neon 提交超时 · 不计为已入库"],["#920204","上游 502 · 待重试"]].map(([id,reason])=><div className="retry-row" key={id}><CircleAlert aria-hidden="true"/><div><b className="mono">{id}</b><p>{reason}</p></div><DemoButton message={`静态演示 · ${id} 未入队。`}>重试<span className="sr-only"> {id}</span></DemoButton></div>)}
 </div></Panel></div></div>}
