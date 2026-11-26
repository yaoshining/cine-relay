import { notFound } from "next/navigation";
import { SyncRunDetail, SyncUnavailable } from "@/components/sync-views";
import { getDb } from "@/lib/db/client";
import { findRun } from "@/lib/db/sync-runs";
import { backfillItems, findBackfillRetry, type BackfillItem } from "@/lib/db/backfill";
import { templateIdSchema } from "@/lib/sync/config";
import { sampleConfigured } from "@/lib/sync/inngest";

function requestTime() { return Date.now(); }

export default async function RunDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string }> }) {
  const { id } = await params;
  if (!templateIdSchema.safeParse(id).success) notFound();
  let run;
  let items: BackfillItem[] = [];
  let retryId: string | null = null;
  try {
    const db = getDb();
    run = await findRun(db, id);
    if (run && run.triggerType !== "sample") [items, retryId] = await Promise.all([backfillItems(db, id), findBackfillRetry(db, id)]);
  } catch {
    return <SyncUnavailable title="运行详情"/>;
  }
  if (!run) notFound();
  return <SyncRunDetail run={run} items={items} retryId={retryId} notice={(await searchParams).notice} configured={sampleConfigured()} asOf={requestTime()}/>;
}
