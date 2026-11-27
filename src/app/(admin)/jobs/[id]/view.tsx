import { notFound } from "next/navigation";
import { Callout, PageHead } from "@/components/console";
import { SyncFormView, SyncUnavailable } from "@/components/sync-views";
import { getDb } from "@/lib/db/client";
import { findTemplate } from "@/lib/db/sync-runs";
import { syncConfigSchema, templateIdSchema } from "@/lib/sync/config";
import { sampleConfigured, schedulerEnabled } from "@/lib/sync/inngest";
import { cursorMatchesTemplate } from "@/lib/db/schedules";

export default async function EditJob({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; notice?: string }> }) {
  const { id } = await params;
  if (!templateIdSchema.safeParse(id).success) notFound();
  let template;
  let cursorReady = false;
  try {
    const db = getDb();
    template = await findTemplate(db, id);
    if (template?.mode === "incremental") cursorReady = await cursorMatchesTemplate(db, id);
  } catch {
    return <SyncUnavailable title="编辑任务模板"/>;
  }
  if (!template) notFound();
  const result = syncConfigSchema.safeParse(template.config);
  if (!result.success) return <div className="page-flow"><PageHead title="编辑任务模板"/><Callout warning>保存的模板格式无法读取。请新建模板。</Callout></div>;
  const query = await searchParams;
  return <SyncFormView id={id} config={result.data} configured={sampleConfigured()} saved={query.saved === "1"} notice={query.notice} enabled={template.enabled} cursorReady={cursorReady} schedulerEnabled={schedulerEnabled}/>;
}
