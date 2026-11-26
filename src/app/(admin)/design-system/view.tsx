import { Check, TriangleAlert, X } from "lucide-react";
import { Callout, PageHead, Panel } from "@/components/console";
import { DemoTable } from "@/components/demo-table";
import { Options } from "@/components/quick-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
const palette = [["画布","background","#090E1A"],["导航","sidebar","#0C1222"],["卡片","card","#11192C"],["输入槽位","well","#0B1221"],["边框","border","#1E2B48"],["电光靛蓝","primary","#687BFF"],["薄荷绿","signal","#35EDB4"],["琥珀黄","warning","#FBBF24"],["珊瑚红","destructive","#F87171"]] as const;
export default function DesignSystem(){return <div className="page-flow"><PageHead title="暗夜信号控制台" sub="CineRelay · Design System / 1.1"/><Callout>静态组件验收页 · 深色层级、Tabular 数字和可访问状态。</Callout>
 <Panel title="设计 Token"><div className="swatch-grid">{palette.map(([n,k,h])=><div key={k}><span style={{background:`var(--${k})`}}/><b>{n}</b><code>{h}</code></div>)}</div></Panel>
 <div className="split"><Panel title="字阶、数字与状态"><div className="in-card-stack"><p className="text-3xl font-bold">每日电影增量</p><p className="text-muted-foreground">管理员正文 / 次要信息</p><code className="text-lg">#920101 · 96.8% · 09:42 CST</code><div className="flex flex-wrap gap-2"><Badge variant="success"><Check/>正常</Badge><Badge variant="warning"><TriangleAlert/>共享冷却</Badge><Badge variant="danger"><X/>失败</Badge></div></div></Panel>
 <Panel title="操作、输入与开关"><div className="in-card-stack"><div className="flex flex-wrap gap-2"><Button>主操作</Button><Button variant="signal">试抓 5 部</Button><Button variant="destructive">撤销</Button></div><label className="control-label">只读 TMDB ID<Input readOnly value="920101"/></label><label className="control-label">禁用字段<Input disabled value="等待后端"/></label><Options label="译文语言" items={[["zh-CN","简体中文"],["en-US","English"]]}/><label className="flex items-center gap-2"><Switch aria-label="示例开关" defaultChecked/>示例开关</label></div></Panel></div>
 <Panel title="表格密度"><DemoTable label="表格样式示例" columns={["TMDB ID","结果","耗时"]} rows={[[<code key="id">#920101</code>,<Badge key="s" variant="success">写入成功</Badge>,<code key="time">2.84 秒</code>]]}/></Panel></div>}
