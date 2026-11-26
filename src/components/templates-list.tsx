'use client';
import Link from 'next/link';
import { Activity, CalendarClock, Clock3, FlaskConical, Pencil, Plus, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { DemoStrip, PageHead } from '@/components/console';
import { FixtureEmpty, FixtureSearch, matchesQuery } from '@/components/fixture-controls';
import { DemoButton, Segmented } from '@/components/static-controls';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { templates } from '@/lib/console-fixtures';

export function TemplatesList(){
 const [query,setQuery]=useState(''),[filter,setFilter]=useState('all');
 const visible=templates.filter(t=>(filter==='all'||(filter==='enabled'?t.enabled:t.mode===filter))&&matchesQuery(query,t.name,t.scope));
 return <div className="page-flow">
  <PageHead title="任务配置" sub="管理电影回填与增量同步模板 · 表单化配置，无需手写 JSON 或 Cron" action={<><Button variant="signal" asChild><Link href="/jobs?sample=1"><FlaskConical/>快速试抓 5 部</Link></Button><Button asChild><Link href="/jobs/new"><Plus/>新建任务模板</Link></Button></>}/>
  <DemoStrip>合成数据 · 不提交调度</DemoStrip>
  <div className="fixture-metrics">
   <section><small><CalendarClock/>已启用定时模板</small><strong>2 <small>个</small></strong><p>每小时扫描 · Asia/Shanghai</p></section>
   <section><small><Clock3/>下次计划触发</small><strong>明日 <code>09:00 CST</code></strong><p>每日电影增量</p></section>
   <section><small><Activity/>当前运行态势</small><strong><i className="fixture-dot"/> <code>#0142</code> 运行中</strong><p>入库完成率 <code className="fresh">96.9%</code></p></section>
  </div>
  <div className="fixture-toolbar"><FixtureSearch placeholder="搜索模板名称或选片条件…" value={query} onChange={setQuery}/><Segmented name="template-filter" label="模板筛选" options={[["all",`全部 ${templates.length}`],["incremental","增量同步"],["once","一次性回填"],["enabled","仅启用"]]} value={filter} onChange={setFilter}/></div>
  <p className="sr-only" aria-live="polite">{visible.length} 个任务模板</p>
  {visible.length?visible.map(t=><article className="template-row" key={t.id}>
   <div className="template-name"><h2>{t.name}</h2><Badge variant={t.mode==='once'?'outline':'secondary'}>{t.mode==='once'?'一次性回填':'增量同步'}</Badge><p>{t.scope}</p></div>
   <div><small>运行计划</small><b>{t.schedule}</b></div><div><small>增量游标</small><code>{t.cursor}</code></div>
   <div><small>定时启用</small><div className="template-inline"><Switch size="sm" checked={t.enabled} disabled className="snapshot-switch" aria-label={`${t.name}定时开关`}/><span>{t.enabled?'启用':'停用'}</span></div></div>
   <div><small>最近运行</small>{'run' in t?<div className="template-inline"><Link className="text-link mono" href={`/runs/${t.run}`}>#{t.run}</Link><Badge variant="success">{t.status}</Badge>{t.run==='0142'&&<code className="fresh">96.9%</code>}</div>:<span className="text-muted-foreground">暂无运行</span>}</div>
   <div className="template-actions"><Button asChild size="xs" variant="signal"><Link href={`/jobs/${t.id}?sample=1`}>试抓<span className="sr-only"> {t.name}</span></Link></Button><DemoButton size="xs" message="静态演示 · 未发起运行。">立即运行</DemoButton><Button asChild size="xs" variant="outline"><Link href={`/jobs/${t.id}`}><Pencil/>编辑<span className="sr-only"> {t.name}</span></Link></Button></div>
   {'warning' in t&&<div className="template-warning"><TriangleAlert aria-hidden="true"/>选片范围已变更 · 需回填或重建游标</div>}
  </article>):<FixtureEmpty/>}
 </div>;
}
