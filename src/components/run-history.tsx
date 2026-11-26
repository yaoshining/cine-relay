'use client';
import Link from 'next/link';
import { Activity, ArrowRight, Check, FlaskConical, Plus, RefreshCw, Timer, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { DemoStrip, PageHead, Panel } from '@/components/console';
import { DemoTable } from '@/components/demo-table';
import { FixtureEmpty, FixturePager, FixtureSearch, FixtureSelect, matchesQuery } from '@/components/fixture-controls';
import { Segmented } from '@/components/static-controls';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { runLabel, runs, runStatus, type RunState } from '@/lib/console-fixtures';
import { number } from '@/lib/demo';
export function RunBadge({status}:{status:RunState}){
 const Icon={running:Activity,complete:Check,sample:FlaskConical,partial:TriangleAlert,dispatch:TriangleAlert}[status];
 return <Badge variant={status==='sample'?'outline':status==='partial'||status==='dispatch'?'warning':'success'}><Icon aria-hidden="true"/>{runStatus[status]}</Badge>;
}
const filters=[['all','全部'],['running','运行中'],['failed','存在失败'],['complete','已完成'],['sample','试抓样本']] as const;
const inFilter=(f:string,s:RunState)=>f==='all'||f===s||(f==='failed'&&(s==='partial'||s==='dispatch'));
export function RunHistory(){
 const [status,setStatus]=useState('all'),[trigger,setTrigger]=useState('all'),[query,setQuery]=useState(''),[page,setPage]=useState(0);
 const filtered=runs.filter(r=>inFilter(status,r.status)&&(trigger==='all'||r.trigger===trigger)&&matchesQuery(query,r.id,runLabel(r.id),r.name));
 const shown=filtered.slice(page*6,page*6+6);
 return <div className="page-flow"><PageHead title="运行历史" sub="正式同步与试抓记录 · 选择记录查看各阶段详情与重试" action={<><Badge variant="outline"><RefreshCw aria-hidden="true"/>低频轮询 · 仅前台可见时刷新</Badge><Button asChild><Link href="/jobs/new"><Plus/>新建运行</Link></Button></>}/><DemoStrip>固定历史快照 · 不连接 Neon 或 Inngest</DemoStrip>
  <div className="fixture-toolbar"><Segmented name="run-filter" label="运行状态" options={filters.map(([key,label])=>[key,`${label} ${runs.filter(r=>inFilter(key,r.status)).length}`])} value={status} onChange={v=>{setStatus(v);setPage(0)}}/><FixtureSearch placeholder="搜索运行 ID / 模板名" value={query} onChange={v=>{setQuery(v);setPage(0)}}/><FixtureSelect label="触发方式" value={trigger} options={[["all","全部触发方式"],["定时计划","定时计划"],["手动立即","手动立即"],["手动试抓","手动试抓"]]} onChange={v=>{setTrigger(v);setPage(0)}}/></div>
  <section className="run-focus" aria-label="当前运行"><strong><i className="fixture-dot"/>运行中 <code>#0142</code> · 每日电影增量</strong><div className="run-focus-progress"><progress value={1240} max={1280} aria-label="入库进度"/><code>96.9% <span>(1,240/1,280)</span></code></div><Badge variant="warning"><Timer aria-hidden="true"/>429 共享退避 14s</Badge><Link href="/runs/0142" className="text-link">进入运行详情<ArrowRight aria-hidden="true"/></Link></section>
  <Panel title="所有运行记录" action={<span className="fixture-meta">CST · 北京时间</span>} className="fixture-table"><div className="fixture-scroll" tabIndex={0} role="region" aria-label="运行历史表格">
   {shown.length?<DemoTable label="运行历史" columns={['运行 ID','任务模板 / 模式','触发方式','计划 / 实际开始','四阶段计数｜发现 → 入队 → 抓取 → 入库','状态','操作']} rows={shown.map(r=>[
    <Link className="text-link mono" key="id" href={`/runs/${r.id}`}>{runLabel(r.id)}</Link>,<div key="name"><b>{r.name}</b><small>{r.mode}</small></div>,r.trigger,<code key="time">{r.planned} / {r.actual}</code>,<code key="counts">{r.status==='sample'?'抽样 5 · 成功 4 · 写入 0 · 失败 1':r.counts.map(number).join(' → ')}</code>,<RunBadge key="status" status={r.status}/>,<Link className="text-link" key="link" href={`/runs/${r.id}`}>{({sample:'查看诊断',partial:'详情 / 重试',dispatch:'安全重派',running:'查看详情',complete:'查看详情'})[r.status]}<ArrowRight aria-hidden="true"/></Link>,
   ])}/>:<FixtureEmpty/>}</div><div className="fixture-table-footer"><span>试抓与正式运行分别统计</span><FixturePager page={page} total={filtered.length} size={6} unit="次运行" change={setPage}/></div></Panel>
 </div>;
}
