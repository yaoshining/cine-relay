import { DemoStrip,PageHead,Panel } from "@/components/console";
import { DemoTable } from "@/components/demo-table";
import { Badge } from "@/components/ui/badge";
export default function Audit(){return <div className="page-flow"><PageHead title="操作审计" sub="凭据启停、重跑任务及撤销操作的追踪记录。"/><DemoStrip>合成事件 · 不含 Token、授权头或原始上游错误响应</DemoStrip><Panel title="最近事件"><DemoTable label="最近审计事件" columns={["时间","操作者","动作","结果"]} rows={[
 [<code key="t">09:02:14</code>,"admin-01","手动重跑 #0142",<Badge key="b" variant="success">已提交</Badge>],
 [<code key="t">昨日 18:43</code>,"admin-01","停用旧 TMDB 凭据",<Badge key="b" variant="success">完成</Badge>],
 [<code key="t">昨日 18:16</code>,"admin-02","撤销旧 VidAll 凭据",<Badge key="b" variant="success">完成</Badge>],
 ]}/></Panel></div>}
