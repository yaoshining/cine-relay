"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/guard";
import { getDb } from "@/lib/db/client";
import { createSampleRun, noteSyncDispatchFailure, queueSyncDispatchRetry, saveTemplate } from "@/lib/db/sync-runs";
import { createBackfill, createBackfillRetry, findBackfillRetry } from "@/lib/db/backfill";
import { rebuildIncrementalCursor, setScheduleEnabled } from "@/lib/db/schedules";
import { parseSyncForm, templateIdSchema } from "./config";
import { sampleConfigured, sendSyncEvent } from "./inngest";

export type SyncFormState = { error?: string };

async function dispatchRun(runId: string, type: "sample" | "manual" | "scheduled") {
  try {
    await sendSyncEvent(runId, type);
  } catch {
    await noteSyncDispatchFailure(getDb(), runId, type);
  }
}

export async function submitSyncForm(templateId: string | null, _state: SyncFormState, form: FormData): Promise<SyncFormState> {
  const actor = await requireAdmin();
  if (templateId !== null && !templateIdSchema.safeParse(templateId).success) return { error: "无效任务模板" };
  const input = parseSyncForm(form);
  if (!input.success) return { error: "请检查名称、日期范围和运行参数。" };
  const intent = form.get("intent");
  if (intent !== "sample" && intent !== "save") return { error: "该操作尚不可用。" };
  if (intent === "sample" && !sampleConfigured()) return { error: "尚未配置 Inngest 或 TMDB，不能发起试抓。" };

  let id: string | null;
  try {
    const db = getDb();
    id = intent === "sample"
      ? await createSampleRun(db, input.data, actor.githubId, templateId ?? undefined)
      : await saveTemplate(db, input.data, actor.githubId, templateId ?? undefined);
  } catch {
    return { error: "暂时无法保存，请检查数据库和迁移状态。" };
  }
  if (!id) return { error: "模板已不存在，请返回任务列表。" };
  if (intent === "sample") {
    try {
      await dispatchRun(id, "sample");
    } catch {
      // A recorded run remains inspectable even if the DB goes down after dispatch.
      redirect(`/runs/${id}?notice=dispatch`);
    }
    redirect(`/runs/${id}`);
  }
  redirect(`/jobs/${id}?saved=1`);
}

export async function retrySyncDispatch(runId: string, type: "sample" | "manual" | "scheduled") {
  const actor = await requireAdmin();
  if (!templateIdSchema.safeParse(runId).success || (type !== "sample" && type !== "manual" && type !== "scheduled")) redirect("/runs");
  if (!sampleConfigured()) redirect(`/runs/${runId}?notice=configuration`);
  try {
    const queued = await queueSyncDispatchRetry(getDb(), runId, actor.githubId, type);
    if (queued) await dispatchRun(queued, type);
  } catch {
    redirect(`/runs/${runId}?notice=dispatch`);
  }
  redirect(`/runs/${runId}`);
}

export async function submitBackfill(templateId: string) {
  const actor = await requireAdmin();
  if (!templateIdSchema.safeParse(templateId).success) redirect("/jobs");
  const template = `/jobs/${templateId}`;
  if (!sampleConfigured()) redirect(`${template}?notice=configuration`);
  let id;
  try {
    id = await createBackfill(getDb(), templateId, actor.githubId);
  } catch {
    redirect(`${template}?notice=save`);
  }
  if (!id) redirect(`${template}?notice=unavailable`);
  try {
    await dispatchRun(id, "manual");
  } catch {
    redirect(`/runs/${id}?notice=dispatch`);
  }
  redirect(`/runs/${id}`);
}

export async function retryBackfill(runId: string) {
  const actor = await requireAdmin();
  if (!templateIdSchema.safeParse(runId).success) redirect("/runs");
  if (!sampleConfigured()) redirect(`/runs/${runId}?notice=configuration`);
  let id;
  let existingId;
  try {
    const db = getDb();
    id = await createBackfillRetry(db, runId, actor.githubId);
    if (!id) existingId = await findBackfillRetry(db, runId);
  } catch {
    redirect(`/runs/${runId}?notice=retry_failed`);
  }
  if (!id) redirect(existingId ? `/runs/${existingId}` : `/runs/${runId}?notice=retry_unavailable`);
  try {
    await dispatchRun(id, "manual");
  } catch {
    redirect(`/runs/${id}?notice=dispatch`);
  }
  redirect(`/runs/${id}`);
}

export async function changeTemplateSchedule(id: string, enabled: boolean) {
  const { githubId } = await requireAdmin();
  if (!templateIdSchema.safeParse(id).success || typeof enabled !== "boolean") redirect("/jobs");
  const path = `/jobs/${id}`;
  let changed;
  try {
    changed = await setScheduleEnabled(getDb(), id, enabled, githubId);
  } catch {
    redirect(path + "?notice=save");
  }
  redirect(path + (changed ? "" : "?notice=schedule"));
}

export async function resetTemplateCursor(id: string, form: FormData) {
  const { githubId } = await requireAdmin();
  if (!templateIdSchema.safeParse(id).success) redirect("/jobs");
  const path = `/jobs/${id}`;
  if (form.get("confirmReset") !== "on") redirect(path + "?notice=confirm");
  try {
    await rebuildIncrementalCursor(getDb(), id, githubId);
  } catch {
    redirect(path + "?notice=save");
  }
  redirect(path);
}
