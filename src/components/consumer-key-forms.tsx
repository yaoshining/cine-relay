"use client";

import { useActionState } from "react";
import { issueKey, revokeKey } from "@/lib/consumer/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function IssueConsumerKey() {
  const [state, submit, pending] = useActionState(issueKey, {});
  return <form action={submit} className="in-card-stack">
    <label className="control-label">应用名称<Input name="name" required maxLength={120} autoComplete="off" placeholder="例如 VidAll 预发布"/></label>
    <div><Button type="submit" disabled={pending}>{pending ? "正在签发…" : "签发应用凭据"}</Button></div>
    {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
    {state.token && <div className="in-card-stack">
      <p role="status">密钥只显示这一次。请保存到调用方服务端的秘密配置。</p>
      <code className="break-all select-all">{state.token}</code>
    </div>}
  </form>;
}

export function RevokeConsumerKey({ id, name }: { id: string; name: string }) {
  const [error, submit, pending] = useActionState(revokeKey.bind(null, id), "");
  return <form action={submit} onSubmit={(event) => {
    if (!window.confirm(`撤销「${name}」的密钥？此操作会立即停止该密钥的访问。`)) event.preventDefault();
  }}>
    <Button type="submit" size="xs" variant="outline" disabled={pending}>{pending ? "撤销中…" : "撤销"}</Button>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </form>;
}
