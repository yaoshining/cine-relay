import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { Panel } from "@/components/console";
import { DemoTable } from "@/components/demo-table";
import { DemoButton } from "@/components/static-controls";
import { Badge } from "@/components/ui/badge";
export function ConsumersPanel({showIssue=false}:{showIssue?:boolean}){
 return <Panel title="VidAll 外部应用凭据" sub="仅服务端调用；仅展示脱敏标识，不能进入管理后台。" className="wrap-panel-header" action={<div className="page-actions"><Link className="text-link" href="/docs/api">查看 /docs/api 文档<ArrowRight aria-hidden="true"/></Link>{showIssue&&<DemoButton indigoOutline message="静态演示 · 未签发凭据。"><Plus data-icon="inline-start"/>签发新凭据</DemoButton>}</div>}><DemoTable label="外部应用凭据" columns={["名称","凭据 ID","状态","最近调用","操作"]} rows={[
 ["VidAll 服务端生产",<code key="id">vidall-prod</code>,<Badge key="s" variant="success">有效</Badge>,"1 分钟前",<DemoButton key="a" danger message="静态演示 · 未撤销凭据。">撤销</DemoButton>],
 ["VidAll 轮换旧凭据",<code key="id">vidall-old</code>,<Badge key="s" variant="danger">已撤销</Badge>,"昨日 18:16","—"],
 ]}/></Panel>;
}
