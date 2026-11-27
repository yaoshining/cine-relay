import Link from "next/link";
import { Callout, PageHead, Panel } from "@/components/console";
import { DemoTable } from "@/components/demo-table";
import { IssueConsumerKey, RevokeConsumerKey } from "@/components/consumer-key-forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getDb } from "@/lib/db/client";
import { listConsumerKeys } from "@/lib/db/consumer-keys";

export default async function Consumers() {
  let keys;
  try {
    keys = await listConsumerKeys(getDb());
  } catch {
    keys = null;
  }
  return <div className="page-flow">
    <PageHead title="外部应用" sub="服务端应用密钥与 GitHub 管理员身份互不相通。" action={<Button variant="outline" asChild><Link href="/docs/api">查看 API 文档</Link></Button>}/>
    {keys === null ? <Callout warning>暂时无法读取凭据，请检查数据库和迁移状态。</Callout> : <>
      <Panel title="签发服务端密钥"><IssueConsumerKey/></Panel>
      <Panel title="最近签发的凭据">
        {keys.length ? <DemoTable label="外部应用凭据" columns={["应用", "凭据 ID", "状态", "操作"]} rows={keys.map((key) => [
          key.name, <code key="id">{key.id}</code>, <Badge key="state" variant={key.revoked_at ? "outline" : "success"}>{key.revoked_at ? "已撤销" : "有效"}</Badge>,
          key.revoked_at ? "—" : <RevokeConsumerKey key="revoke" id={key.id} name={key.name}/>,
        ])}/> : <p className="empty-panel">尚未签发应用凭据。</p>}
      </Panel>
    </>}
  </div>;
}
