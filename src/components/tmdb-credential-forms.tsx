"use client";

import { useActionState } from "react";
import { addCredential, toggleCredential } from "@/lib/tmdb/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AddTmdbCredential({ configured }: { configured: boolean }) {
  const [state, action, pending] = useActionState(addCredential, {});
  return <form action={action} className="in-card-stack">
    <label className="control-label">凭据名称<Input name="name" maxLength={120} required disabled={!configured}/></label>
    <label className="control-label">API Read Access Token<Input name="token" type="password" autoComplete="new-password" maxLength={4096} required disabled={!configured}/></label>
    <div><Button type="submit" disabled={!configured || pending}>{pending ? "加密保存中…" : "添加凭据"}</Button></div>
    {state.message && <p role={state.ok ? "status" : "alert"} className="text-sm">{state.message}</p>}
  </form>;
}

export function ToggleTmdbCredential({ id, enabled }: { id: string; enabled: boolean }) {
  const [state, action, pending] = useActionState(toggleCredential.bind(null, id, !enabled), {});
  return <form action={action}>
    <Button size="xs" variant="outline" disabled={pending}>{enabled ? "停用" : "启用"}</Button>
    {state.message && <p role="alert" className="text-sm">{state.message}</p>}
  </form>;
}
