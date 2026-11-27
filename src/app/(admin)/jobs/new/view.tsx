import { SyncFormView } from "@/components/sync-views";
import { sampleConfigured } from "@/lib/sync/inngest";

export default async function NewJob({ searchParams }: { searchParams: Promise<{ sample?: string }> }) {
  const quick = (await searchParams).sample === "1";
  const year = new Date().getUTCFullYear() - 1;
  return <SyncFormView configured={sampleConfigured()} config={{
    version: 1, name: quick ? "快速试抓" : "", mode: "backfill", fieldGroup: "movie_details", schedule: { kind: "manual" },
    selection: { releaseFrom: `${year}-01-01`, releaseThrough: `${year}-12-31`, genreIds: [], originalLanguage: null, locale: "zh-CN", limit: 25 },
  }}/>;
}
