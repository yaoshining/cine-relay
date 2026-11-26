"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/guard";
import { getDb } from "@/lib/db/client";
import { issueConsumerKey, revokeConsumerKey } from "@/lib/db/consumer-keys";

export type IssueState = { token?: string; error?: string };

export async function issueKey(_prev: IssueState, form: FormData): Promise<IssueState> {
  const actor = await requireAdmin();
  const name = z.string().trim().min(1).max(120).refine((value) => !value.includes("\0")).safeParse(form.get("name"));
  if (!name.success) return { error: "请输入有效的应用名称。" };
  let issued;
  try {
    issued = await issueConsumerKey(getDb(), name.data, actor.githubId);
  } catch {
    return { error: "暂时无法签发凭据。" };
  }
  revalidatePath("/consumers");
  return issued ? { token: issued.token } : { error: "暂时无法签发凭据。" };
}

export async function revokeKey(id: string): Promise<string> {
  const actor = await requireAdmin();
  if (!z.uuid().safeParse(id).success) return "无效的凭据。";
  try {
    await revokeConsumerKey(getDb(), id, actor.githubId);
  } catch {
    return "暂时无法撤销凭据。";
  }
  revalidatePath("/consumers");
  return "";
}
