'use client';
import { Check, Download, Info, ShieldCheck, X } from 'lucide-react';
import { useState } from 'react';
import { DemoStrip, PageHead, Panel } from '@/components/console';
import { DemoTable } from '@/components/demo-table';
import { FixtureEmpty, FixturePager, FixtureSearch, FixtureSelect, matchesQuery } from '@/components/fixture-controls';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { auditEvents } from '@/lib/console-fixtures';

const columns=['时间 (CST)','操作者','类别','动作与目标','脱敏摘要','结果'];
const categories=[...new Set(auditEvents.map(e=>e.category))];
function exportCsv(events:typeof auditEvents){
 const lines=[columns,...events.map(e=>[e.time,e.actor,e.category,`${e.action} · ${e.target}`,e.summary,e.ok?'成功':'已拒绝'])];
 const csv=lines.map(row=>row.map(v=>`"${v.replaceAll('"','""')}"`).join(',')).join('\r\n');
 const url=URL.createObjectURL(new Blob(['\ufeff',csv],{type:'text/csv;charset=utf-8'}));
 const link=document.createElement('a');link.href=url;link.download='cinerelay-audit-demo.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function AuditLog(){
 const [query,setQuery]=useState(''),[category,setCategory]=useState('all'),[result,setResult]=useState('all'),[window,setWindow]=useState('7'),[page,setPage]=useState(0);
 const cutoff=window==='1'?'2026-11-26':'2026-11-20';
 const matches=auditEvents.filter(e=>e.time>=cutoff&&(category==='all'||category===e.category)&&(result==='all'||e.ok===(result==='success'))&&matchesQuery(query,e.actor,e.action,e.target));
 const visible=matches.slice(page*7,page*7+7);
 return <div className="page-flow">
 <PageHead title="操作审计" sub="记录凭据变更、任务重跑、密钥撤销与访问拦截 · 不记录密钥或 Token 原文" action={<><Badge variant="outline"><ShieldCheck aria-hidden="true"/>只读审计流</Badge><Button variant="outline" onClick={()=>exportCsv(matches)} disabled={!matches.length}><Download/>导出脱敏 CSV</Button></>}/>
 <DemoStrip>合成事件 · 时间范围以示例日期 2026-11-26 为基准</DemoStrip>
 <div className="fixture-toolbar"><FixtureSearch placeholder="按操作者、动作或目标 ID 检索…" value={query} onChange={v=>{setQuery(v);setPage(0)}}/><FixtureSelect label="类别" value={category} options={[["all","全部类别"],...categories.map(c=>[c,c] as const)]} onChange={v=>{setCategory(v);setPage(0)}}/><FixtureSelect label="结果" value={result} options={[["all","全部结果"],["success","成功"],["denied","已拒绝"]]} onChange={v=>{setResult(v);setPage(0)}}/><FixtureSelect label="时间范围" value={window} options={[["7","最近 7 天"],["1","示例当日"]]} onChange={v=>{setWindow(v);setPage(0)}}/></div>
 <Panel title="最近操作记录" action={<span className="fixture-meta">CST · 北京时间</span>} className="fixture-table audit-fixtures"><div className="fixture-scroll" tabIndex={0} role="region" aria-label="审计记录表格">
 {visible.length?<DemoTable label="最近审计事件" columns={columns} rows={visible.map(e=>[<code key="time">{e.time}</code>,<code key="actor">{e.actor}</code>,<Badge key="category" variant={e.ok?'outline':'danger'}>{e.category}</Badge>,<div key="action"><b>{e.action}</b><small className="mono">{e.target}</small></div>,e.summary,<Badge key="result" variant={e.ok?'success':'danger'}>{e.ok?<Check aria-hidden="true"/>:<X aria-hidden="true"/>}{e.ok?'成功':'已拒绝'}</Badge>])}/>:<FixtureEmpty/>}</div>
 <div className="fixture-table-footer"><span><Info aria-hidden="true"/>只展示脱敏标识，不含授权头或原始上游响应。</span><FixturePager page={page} total={matches.length} size={7} unit="条审计记录" change={setPage}/></div></Panel>
 </div>;
}
