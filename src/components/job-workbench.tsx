import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DemoButton } from "@/components/static-controls";
import { Callout, DemoStrip,PageHead } from "@/components/console";
import { SampleBuilder } from "@/components/sample-builder";
import { type templates } from "@/lib/console-fixtures";
export type JobQuery={sample?:string;year?:string;genre?:string;locale?:string};
export function JobWorkbench({query,template}:{query:JobQuery;template?:(typeof templates)[number]}){
 const year=template?.year??(["2026","2025","2024"].includes(query.year??"")?query.year!:"2026");
 return <div className="page-flow">
 <nav aria-label="面包屑" className="breadcrumbs"><Link href="/jobs" className="text-link"><ArrowLeft aria-hidden="true"/>返回任务配置</Link><span aria-hidden="true">/</span><span>{template?.name??"配置抓取任务"}</span></nav>
 <PageHead title="配置抓取任务" sub="可视化配置手动或计划任务。先试抓最多 5 部，再决定是否正式写入。" action={<DemoButton message="静态演示 · 未保存任务模板。">保存模板</DemoButton>}/>
 <DemoStrip>示例表单与试抓诊断 · 不创建任务、不提交调度</DemoStrip>
 {template&&"warning" in template&&<Callout warning>选片范围已变更 · 需回填或重建游标</Callout>}
 <SampleBuilder showSample={query.sample==="1"} year={year} locale={query.locale==="en-US"?"en-US":"zh-CN"} genre={template?.genre??(query.genre==="all"?"all":"drama")} initialMode={template?.mode==="incremental"?"inc":"once"} initialSchedule={template?.id==="daily"?"daily":template?.id==="weekly"?"weekly":"manual"} originalLanguage={template?.id==="anime"?"ja":"any"} yearLabel={template?.id==="weekly"?"2015–2025":template?.id==="anime"?"2020–2026":undefined}/>
 </div>;
}
