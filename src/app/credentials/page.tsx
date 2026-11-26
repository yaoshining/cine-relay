import { CircleAlert, Plus } from "lucide-react";
import { Callout, DemoStrip, PageHead, Panel } from "@/components/console";
import { ConsumersPanel } from "@/components/consumer-table";
import { DemoTable } from "@/components/demo-table";
import { DemoButton } from "@/components/static-controls";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
export default function Credentials(){return <div className="page-flow">
 <PageHead title="凭据与访问控制" sub="服务端加密存储 · 不回显 Token 原文 · 敏感操作记入审计日志" action={<DemoButton primary message="静态演示 · 未添加凭据。"><Plus data-icon="inline-start"/>添加 TMDB 凭据</DemoButton>}/>
 <DemoStrip>只展示示例标识和状态 · 未配置真实凭据</DemoStrip>
 <Panel title="TMDB 上游凭据池 · 共享并发预算"><div className="in-card-stack"><Callout warning><b>429 共享限流退避中 · 剩余 18 秒</b><small>尊重 Retry-After，所有请求共用冷却期。不切换凭据绕过限流。</small></Callout>
 <div className="pool-meter"><div><b>共享并发预算</b><span className="mono">当前并发 2 / 2 批次 · 100%</span></div><div role="meter" aria-label="共享并发批次" aria-valuenow={2} aria-valuemin={0} aria-valuemax={2} className="pool-meter-track"/></div>
 <DemoTable label="TMDB 凭据" columns={["名称","脱敏 ID","启用","状态","最近活动"]} rows={[
 ["常规主凭据",<code key="id">tmdb_••••_9f2a</code>,<Switch key="sw" className="snapshot-switch" checked disabled aria-label="常规主凭据已启用"/>,<Badge key="s" variant="warning"><CircleAlert/>429 · 共享冷却</Badge>,"2 分钟前"],
 ["备用凭据",<code key="id">tmdb_••••_4c81</code>,<Switch key="sw" className="snapshot-switch" checked={false} disabled aria-label="备用凭据待命"/>,<Badge key="s" variant="outline">待命 · 共享退避</Badge>,"昨日"],
 ["旧凭据",<code key="id">tmdb_••••_1b09</code>,<Switch key="sw" className="snapshot-switch" checked={false} disabled aria-label="旧凭据已停用"/>,<Badge key="s" variant="outline">已停用</Badge>,"—"],
 ]}/></div></Panel><ConsumersPanel showIssue/></div>}
