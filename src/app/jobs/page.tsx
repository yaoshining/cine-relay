import { DemoButton } from "@/components/static-controls";
import { DemoStrip,PageHead,Panel } from "@/components/console";
import { SampleBuilder } from "@/components/sample-builder";
import { Badge } from "@/components/ui/badge";
export default async function Jobs({searchParams}:{searchParams:Promise<{sample?:string;year?:string;genre?:string;locale?:string}>}){
 const p=await searchParams;
 return <div className="page-flow"><PageHead title="配置抓取任务" sub="可视化配置手动或计划任务。先试抓最多 5 部，再决定是否正式写入。" action={<DemoButton message="静态演示 · 未保存任务模板。">保存模板</DemoButton>}/>
 <DemoStrip>示例表单与试抓诊断 · 不创建任务、不提交调度</DemoStrip>
 <SampleBuilder showSample={p.sample==="1"} year={["2026","2025","2024"].includes(p.year??"")?p.year!:"2026"} locale={p.locale==="en-US"?"en-US":"zh-CN"} genre={p.genre==="all"?"all":"drama"}/>
 <Panel title="任务模板"><div className="flex flex-wrap gap-3 text-sm"><Badge variant="outline">每日电影增量 · 09:00 CST</Badge><Badge variant="outline">2026 热门电影回填 · 手动</Badge></div></Panel></div>;
}
