import { SyncRunList, SyncUnavailable } from "@/components/sync-views";
import { getDb } from "@/lib/db/client";
import { listRuns } from "@/lib/db/sync-runs";

export default async function Runs() {
  let records;
  try {
    records = await listRuns(getDb());
  } catch {
    return <SyncUnavailable title="运行历史"/>;
  }
  return <SyncRunList records={records}/>;
}
