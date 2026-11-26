import Link from "next/link";
import { ArrowLeft, FlaskConical, Plus } from "lucide-react";
import { Callout, PageHead, Panel } from "@/components/console";
import { DemoTable } from "@/components/demo-table";
import { SyncForm } from "@/components/sync-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { listRuns, SyncRun, SyncTemplate } from "@/lib/db/sync-runs";
import { type SyncConfig, syncConfigSchema } from "@/lib/sync/config";
import { sampleSummarySchema } from "@/lib/sync/sample";
import { changeTemplateSchedule, resetTemplateCursor, retryBackfill, retrySyncDispatch, submitBackfill } from "@/lib/sync/actions";
import { backfillLimit, type BackfillItem } from "@/lib/db/backfill";
import { RunRefresh } from "@/components/run-refresh";

export const syncStatus = {
  queued: "排队中", dispatch_failed: "派发失败", running: "抓取中",
  completed: "已完成", partial_failed: "部分失败", failed: "失败",
} as const;

const reason = {
  unauthorized: "TMDB 凭据不可用", rate_limited: "TMDB 限流", not_found: "TMDB 未找到电影", timeout: "TMDB 请求超时",
  upstream_error: "TMDB 请求失败", invalid_response: "TMDB 返回数据无效", invalid_config: "配置快照无效",
  not_configured: "缺少运行配置", execution_failed: "执行失败", budget_unavailable: "共享 TMDB 预算暂不可用",
  cursor_reset_required: "游标已失效，请在模板中重建", incomplete_window: "变更窗口未完整读取，未推进游标",
} as const;

const time = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai", dateStyle: "short", timeStyle: "medium" });
function localTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00"));
  return Number.isFinite(date.getTime()) ? time.format(date) : value;
}

export function SyncUnavailable({ title }: { title: string }) {
  return <div className="page-flow"><PageHead title={title}/><Callout warning>暂时无法读取任务数据库。请检查连接和迁移状态后重试。</Callout></div>;
}

export function SyncTemplateList({ templates }: { templates: SyncTemplate[] }) {
  return <div className="page-flow">
    <PageHead title="任务配置" sub="保存选片范围、语言与运行计划。定时计划按北京时间执行。" action={<>
      <Button variant="signal" asChild><Link href="/jobs/new?sample=1"><FlaskConical aria-hidden="true"/>快速试抓</Link></Button>
      <Button asChild><Link href="/jobs/new"><Plus aria-hidden="true"/>新建模板</Link></Button>
    </>}/>
    <Panel title="最近更新的任务模板">
      {templates.length ? <DemoTable label="任务模板" columns={["模板", "模式", "选片范围", "运行计划", "操作"]} rows={templates.map((template) => {
        const { data } = syncConfigSchema.safeParse(template.config);
        const plan = data?.schedule;
        return [
          <b key="name">{template.name}</b>, template.mode === "incremental" ? "增量同步" : "一次性回填",
          data ? `${data.selection.releaseFrom} ～ ${data.selection.releaseThrough} · ${data.selection.locale}` : "未配置",
          !plan || plan.kind === "manual" ? "手动" : `${plan.kind === "daily" ? "每日" : `每周（星期 ${plan.weekday}）`} ${String(plan.hour).padStart(2,"0")}:00 北京时间 · ${template.enabled ? "已开启" : "未开启"}`,
          <Link key="action" className="text-link" href={`/jobs/${template.id}`}>编辑／试抓</Link>,
        ];
      })}/> : <p className="empty-panel">暂无任务模板。可以新建模板，也可以直接试抓。</p>}
    </Panel>
  </div>;
}

export function SyncFormView({ config, id, saved, configured, notice, enabled = false, cursorReady = false, schedulerEnabled = false }: {
  config: SyncConfig; id?: string; saved?: boolean; configured: boolean; notice?: string;
  enabled?: boolean; cursorReady?: boolean; schedulerEnabled?: boolean;
}) {
  const incremental = config.mode === "incremental";
  return <div className="page-flow">
    <nav aria-label="面包屑" className="breadcrumbs"><Link className="text-link" href="/jobs"><ArrowLeft aria-hidden="true"/>返回任务配置</Link></nav>
    <PageHead title={id ? "编辑任务模板" : "配置抓取任务"} sub="先保存模板，或直接用当前配置试抓。"/>
    {saved && <Callout tone="signal">任务模板已保存。</Callout>}
    {notice === "configuration" && <Callout warning>尚未配置 Inngest 或 TMDB，不能发起同步。</Callout>}
    {notice === "save" && <Callout warning>暂时无法保存运行，请检查数据库和迁移状态。</Callout>}
    {notice === "unavailable" && <Callout warning>无法使用此模板运行；增量模板须先重建游标。</Callout>}
    {notice === "schedule" && <Callout warning>请选择已保存的日／周计划；增量模板须先初始化游标。</Callout>}
    {notice === "confirm" && <Callout warning>请确认重建游标会清理该模板待处理队列。</Callout>}
    {id && <Panel title="正式同步与定时">
      <div className="in-card-stack">
        <p className="text-sm">使用已保存的配置，单次最多同步 {Math.min(config.selection.limit, backfillLimit)} 部。{incremental ? "增量只刷新符合范围的已有电影。" : "回填可添加尚未缓存的电影。"}</p>
        {incremental && <form action={resetTemplateCursor.bind(null, id)} className="in-card-stack">
          <p className="text-sm">{cursorReady ? "增量游标已就绪。" : "增量游标未初始化或范围已修改。"}</p>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="confirmReset" required/>确认清理待处理队列，并从上一 UTC 日重建游标</label>
          <div><Button type="submit" variant="outline">重建游标</Button></div>
        </form>}
        <div className="flex flex-wrap gap-2">
          <form action={submitBackfill.bind(null, id)}><Button type="submit" variant="outline" disabled={!configured || incremental && !cursorReady}>立即同步</Button></form>
          {config.schedule.kind !== "manual" && <form action={changeTemplateSchedule.bind(null, id, !enabled)}><Button type="submit" variant="outline" disabled={!enabled && incremental && !cursorReady}>{enabled ? "停用定时" : "开启定时"}</Button></form>}
        </div>
        {config.schedule.kind !== "manual" && <p className="text-sm text-muted-foreground">
          {enabled ? "模板计划已开启。" : "模板计划未开启。"}{!schedulerEnabled && " 部署环境的每小时扫描未开启。"}
        </p>}
      </div>
    </Panel>}
    <SyncForm key={id ?? "new"} id={id} config={config} configured={configured}/>
  </div>;
}

export function SyncRunList({ records }: { records: Awaited<ReturnType<typeof listRuns>> }) {
  return <div className="page-flow"><PageHead title="运行历史" sub="最近 50 次数据库运行记录 · 北京时间" action={<Button asChild><Link href="/jobs/new?sample=1">发起试抓</Link></Button>}/>
    <Panel title="最近运行">
      {records.length ? <DemoTable label="运行历史" columns={["运行 ID", "任务", "触发方式", "创建时间", "状态"]} rows={records.map((run) => [
        <Link key="id" href={`/runs/${run.id}`} className="text-link mono">{run.id.slice(0, 8)}</Link>,
        run.name ?? "未命名任务", run.triggerType === "sample" ? "手动试抓" : run.triggerType === "scheduled" ? "定时" : "手动",
        localTime(run.createdAt), <Badge key="status" variant="outline">{syncStatus[run.status]}</Badge>,
      ])}/> : <p className="empty-panel">暂无运行记录。</p>}
    </Panel>
  </div>;
}

const itemStatus = {
  pending: "未抓取", fetched: "已抓取 · 尚未入库", stored: "已入库", unchanged: "已有相同或更新的缓存",
  removed: "已下架 · 不写入", failed: "抓取失败", deferred: "未尝试 · 已停止",
} as const;

function explainReason(code: unknown) {
  return typeof code === "string" && Object.hasOwn(reason, code) ? reason[code as keyof typeof reason] : null;
}

export function SyncRunDetail({ run, notice, configured, items = [], retryId, asOf }: {
  run: SyncRun; notice?: string; configured: boolean; items?: BackfillItem[]; retryId?: string | null; asOf: number;
}) {
  const { data: config } = syncConfigSchema.safeParse(run.configSnapshot);
  const { data: report } = sampleSummarySchema.safeParse(run.resultSummary);
  const pending = run.status === "queued" || run.status === "running";
  const backfill = run.triggerType !== "sample" && !!config;
  const retryAt = typeof run.resultSummary?.retryAt === "string" ? run.resultSummary.retryAt : null;
  const cooling = retryAt !== null && Date.parse(retryAt) > asOf;
  const retryable = run.status === "partial_failed" || run.status === "failed";
  const failure = explainReason(run.resultSummary?.code);
  return <div className="page-flow">
    {pending && <RunRefresh/>}
    <nav aria-label="面包屑" className="breadcrumbs"><Link className="text-link" href="/runs"><ArrowLeft aria-hidden="true"/>返回运行历史</Link></nav>
    <PageHead title={run.triggerType === "sample" ? "试抓诊断" : "运行详情"} sub={config?.name ?? "未命名任务"} action={<Badge variant="outline">{syncStatus[run.status]}</Badge>}/>
    {notice === "dispatch" && <Callout warning>暂时无法确认派发状态，请刷新查看最新记录。</Callout>}
    {notice === "configuration" && <Callout warning>尚未配置 Inngest 或 TMDB，无法重新提交。</Callout>}
    {notice === "retry_failed" && <Callout warning>暂时无法保存重试记录。</Callout>}
    {notice === "retry_unavailable" && <Callout warning>此运行尚不能重试，或正在退避。</Callout>}
    {run.status === "dispatch_failed" && (run.triggerType === "sample" || backfill) && <Panel title="派发失败">
      <p className="mb-3 text-sm">Inngest 未确认接收，可以用原运行标识重派。</p>
      <form action={retrySyncDispatch.bind(null, run.id, run.triggerType)}><Button disabled={!configured} variant="outline" type="submit">安全重派</Button></form>
    </Panel>}
    <Panel title="运行快照" sub="北京时间 · 已锁定配置">
      <div className="in-card-stack">
        <code className="break-all">{run.id}</code>
        <p className="text-sm">创建：{localTime(run.createdAt)} · 开始：{localTime(run.startedAt)} · 结束：{localTime(run.finishedAt)}</p>
        {run.scheduledAt && <p className="text-sm">计划时间：{localTime(run.scheduledAt)}</p>}
        {config && <p className="text-sm">{config.selection.releaseFrom} ～ {config.selection.releaseThrough} · {config.selection.locale} · 原片语言 {config.selection.originalLanguage ?? "不限"} · 类别 {config.selection.genreIds.join(" / ") || "不限"}</p>}
      </div>
    </Panel>
    {backfill && <Panel title="正式同步进度">
      <div className="in-card-stack">
        {run.retryOf && <Link className="text-link" href={`/runs/${run.retryOf}`}>查看上一次运行</Link>}
        <p className="text-sm">{`发现 / 入队 ${items.length} · 已抓取 ${items.filter((item) => item.fetchedAt).length} · 已入库 ${items.filter((item) => item.status === "stored").length} · 抓取失败 ${items.filter((item) => item.status === "failed").length}`}</p>
        {failure && <Callout warning>{failure}{retryAt && ` · 可重试时间：${localTime(retryAt)}`}</Callout>}
        {run.resultSummary?.pageLimitReached === true && <Callout>达到选片页数上限，仅处理已找到的电影。</Callout>}
        {items.length > 0 && <DemoTable label="电影同步状态" columns={["TMDB ID", "状态", "抓取时间"]} rows={items.map((item) => [
          <code key="id">#{item.tmdbId.toString()}</code>, [itemStatus[item.status], explainReason(item.errorCode)].filter(Boolean).join(" · "), localTime(item.fetchedAt),
        ])}/>}
        {items.length === 0 && <p className="text-sm text-muted-foreground">{pending ? "等待选片。" : "没有入队的电影。"}</p>}
        {retryId ? <Link className="text-link" href={`/runs/${retryId}`}>查看重试运行</Link> : retryable &&
          <form action={retryBackfill.bind(null, run.id)}>
            <Button type="submit" variant="outline" disabled={!configured || cooling}>{cooling ? "退避中，稍后刷新" : "重试未完成项"}</Button>
          </form>}
      </div>
    </Panel>}
    {run.triggerType === "sample" && <Panel title="试抓结果">
      <div className="in-card-stack">
        <Callout tone="signal">试抓不会写入电影缓存或推进游标。</Callout>
        {report?.kind === "failure" && <Callout warning>{reason[report.code]}{report.retryAt && ` · 可重试时间：${localTime(report.retryAt)}`}</Callout>}
        {report?.kind === "sample" && <>
          <p className="text-sm">抽样 {report.selected} · 成功 {report.movies.length} · 入库 0 · 失败 {report.failures.length} · 未尝试 {report.unattempted}</p>
          {report.pageLimitReached && <Callout>达到试抓选片页数上限，仅展示已找到的候选。</Callout>}
          {report.movies.length > 0 && <DemoTable label="试抓成功" columns={["TMDB ID", "片名", "返回字段"]} rows={report.movies.map((movie) => [<code key="id">#{movie.tmdbId}</code>, movie.title,
            `${movie.titleProvided ? "有返回标题" : "使用原片名"} · ${movie.overviewProvided ? "有返回简介" : "简介缺失"}`])}/>}
          {report.failures.length > 0 && <DemoTable label="试抓失败" columns={["TMDB ID", "失败原因", "可重试时间"]} rows={report.failures.map((failure) => [<code key="id">#{failure.tmdbId}</code>, reason[failure.code], localTime(failure.retryAt)])}/>}
          <p className="text-xs text-muted-foreground">请求语言 {report.locale}。标题或简介存在不代表上游没有回退到其他语言。</p>
        </>}
        {!report && <p className="text-sm text-muted-foreground">{pending ? "等待 Inngest 返回结果；页面可见时会自动刷新。" : "没有可展示的试抓结果。"}</p>}
      </div>
    </Panel>}
  </div>;
}
