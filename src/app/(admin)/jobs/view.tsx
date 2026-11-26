import { redirect } from "next/navigation";
import { SyncTemplateList, SyncUnavailable } from "@/components/sync-views";
import { getDb } from "@/lib/db/client";
import { listTemplates } from "@/lib/db/sync-runs";

export default async function Jobs({ searchParams }: { searchParams: Promise<{ sample?: string }> }) {
  if ((await searchParams).sample === "1") redirect("/jobs/new?sample=1");
  let templates;
  try {
    templates = await listTemplates(getDb());
  } catch {
    return <SyncUnavailable title="任务配置"/>;
  }
  return <SyncTemplateList templates={templates}/>;
}
