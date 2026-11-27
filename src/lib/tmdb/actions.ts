"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/guard";
import { getDb } from "@/lib/db/client";
import { addTmdbCredential, setTmdbCredentialEnabled } from "@/lib/db/tmdb-credentials";
import { parsePoolKey, sealCredential } from "./credential-crypto";

export type PoolActionResult = { message?: string; ok?: boolean };

export async function addCredential(_state: PoolActionResult, form: FormData): Promise<PoolActionResult> {
  const { githubId } = await requireAdmin();
  const key = parsePoolKey(process.env.TMDB_KEY_ENCRYPTION_KEY);
  if (!key) return { message: "请先配置服务端凭据池加密密钥。" };
  const name = z.string().trim().min(1).max(120).refine((value) => !value.includes("\0")).safeParse(form.get("name"));
  const token = z.string().trim().regex(/^[A-Za-z0-9._~-]{24,4096}$/).safeParse(form.get("token"));
  if (!name.success || !token.success) return { message: "请检查名称和 TMDB API Read Access Token。" };
  const id = randomUUID();
  try {
    await addTmdbCredential(getDb(), id, name.data, sealCredential(key, id, token.data), githubId);
  } catch {
    return { message: "暂时无法保存凭据。" };
  }
  revalidatePath("/credentials");
  return { ok: true, message: "已加密保存。下次使用时会检查上游状态。" };
}

export async function toggleCredential(id: string, enabled: boolean): Promise<PoolActionResult> {
  const { githubId } = await requireAdmin();
  if (!z.uuid().safeParse(id).success || typeof enabled !== "boolean") return { message: "无效凭据。" };
  try {
    await setTmdbCredentialEnabled(getDb(), id, enabled, githubId);
  } catch {
    return { message: "暂时无法更新凭据。" };
  }
  revalidatePath("/credentials");
  return { ok: true };
}
