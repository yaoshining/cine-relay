import { Clock3, CircleAlert, RefreshCw } from "lucide-react";
import { Callout, DemoStrip, PageHead, Panel, Relay } from "@/components/console";
import { DemoTable } from "@/components/demo-table";
import { DemoButton } from "@/components/static-controls";
import { Badge } from "@/components/ui/badge";

const batch = [
 ["#48","25 条","已完成","已提交","2.84 秒"],["#49","25 条","已完成","已提交","3.12 秒"],["#50","25 条","已完成","已提交","2.96 秒"],["#51","25 条","已完成","提交超时","5.00 秒"],["#52","25 条","退避中","待入库","—"]
];
export default function Runs(){return <div className="page-flow">
 <nav aria-label="面包屑" className="breadcrumbs"><span>运行历史</span><span aria-hidden="true">/</span><span>每日电影增量 <code>#0142</code></span></nav>
 <PageHead title="每日电影增量 #0142" sub="计划 09:00 CST · 实际 09:02 CST · 配置快照已锁定" action={<><DemoButton>暂停任务</DemoButton><DemoButton primary><RefreshCw data-icon="inline-start"/>重试失败项（2）</DemoButton></>}><Badge variant="success"><Clock3/>运行中</Badge></PageHead>
 <DemoStrip>固定运行快照 · 不调用 Inngest 或数据库</DemoStrip><Panel title="同步阶段进度 · Inngest 编排"><Relay full/></Panel>
 <div className="split"><Panel title="批次执行记录"><DemoTable label="演示批次" columns={["批次","条数","TMDB 抓取","Neon 入库","耗时"]} rows={batch.map(([id,n,fetch,db,time])=>[<code key="id">{id}</code>,n,<Badge key="f" variant={fetch==="已完成"?"success":"warning"}>{fetch}</Badge>,<Badge key="d" variant={db==="已提交"?"success":"warning"}>{db}</Badge>,<span key="t" className="mono">{time}</span>])}/></Panel>
 <Panel title="异常与安全重试队列"><div className="in-card-stack"><Callout warning><b>429 共享退避 · Retry-After 14 秒</b><small>共享冷却中，不切换凭据绕过限流。</small></Callout>
 {[["#920188","Neon 提交超时 · 不计为已入库"],["#920204","上游 502 · 待重试"]].map(([id,reason])=><div className="retry-row" key={id}><CircleAlert aria-hidden="true"/><div><b className="mono">{id}</b><p>{reason}</p></div><DemoButton message={`静态演示 · ${id} 未入队。`}>重试<span className="sr-only"> {id}</span></DemoButton></div>)}
 </div></Panel></div></div>}
