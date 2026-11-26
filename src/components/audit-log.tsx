"use client";

import { Check, Download, Info, ShieldCheck, X } from "lucide-react";
import { useState } from "react";
import { Callout, PageHead, Panel } from "@/components/console";
import { DemoTable } from "@/components/demo-table";
import { FixturePager, FixtureSearch, FixtureSelect, matchesQuery } from "@/components/fixture-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AdminAuditEvent } from "@/lib/db/admin-audit";

const columns = ["时间 (CST)", "操作者", "类别", "动作与目标", "结果"];
const outcomes = { succeeded: "通过", denied: "已拒绝", failed: "失败" } as const;
const time = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit",
});

function display(event: AdminAuditEvent) {
  return {
    time: time.format(new Date(event.createdAt)),
    actor: `github:${event.actorGithubId}`,
    category: event.targetType === "admin_access" ? "管理员访问" : event.targetType,
    action: event.action === "admin.oauth.admission" ? "GitHub OAuth 登录准入" : event.action,
    target: event.targetId ?? "—",
    outcome: outcomes[event.outcome],
  };
}

function csvField(value: string) {
  // Quoting prevents delimiters from breaking out of the cell. Neutralize
  // formula prefixes as well so identifiers are safe in spreadsheet exports.
  if (/^\s*[=+\-@]/u.test(value) || /^[\t\r\n]/u.test(value)) value = "'" + value;
  return `"${value.replaceAll('"', '""')}"`;
}

function exportCsv(events: AdminAuditEvent[]) {
  const lines = events.map((event) => {
    const e = display(event);
    return [e.time, e.actor, e.category, `${e.action} · ${e.target}`, e.outcome];
  });
  const csv = [columns, ...lines].map((row) => row.map(csvField).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "cinerelay-audit.csv";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function AuditLog({ events, asOf }: { events: AdminAuditEvent[] | null; asOf: number }) {
  const [query, setQuery] = useState(""), [category, setCategory] = useState("all");
  const [result, setResult] = useState("all"), [window, setWindow] = useState("all"), [page, setPage] = useState(0);
  const categories = [...new Map(events?.map((e) => [e.targetType, display(e).category])).entries()];
  const cutoff = window === "all" ? -Infinity : asOf - Number(window) * 86_400_000;
  const matches = (events ?? []).filter((e) => {
    const row = display(e);
    return Date.parse(e.createdAt) >= cutoff && (category === "all" || category === e.targetType)
      && (result === "all" || result === e.outcome)
      && matchesQuery(query, row.actor, row.action, row.target);
  });
  const visible = matches.slice(page * 7, page * 7 + 7);

  return <div className="page-flow">
    <PageHead title="操作审计" sub="记录 GitHub 登录准入判定 · 不记录密钥或 Token 原文" action={<>
      <Badge variant="outline"><ShieldCheck aria-hidden="true"/>只读审计流</Badge>
      <Button variant="outline" onClick={() => exportCsv(matches)} disabled={!matches.length}><Download aria-hidden="true"/>导出脱敏 CSV</Button>
    </>}/>
    {events === null ? <Callout warning>暂时无法读取操作审计。请检查数据库配置和迁移状态后刷新。</Callout> : <>
      <div className="fixture-toolbar">
        <FixtureSearch placeholder="按操作者、动作或目标 ID 检索…" value={query} onChange={(v) => {setQuery(v); setPage(0);}}/>
        <FixtureSelect label="类别" value={category} options={[["all", "全部类别"], ...categories]} onChange={(v) => {setCategory(v); setPage(0);}}/>
        <FixtureSelect label="结果" value={result} options={[["all", "全部结果"], ...Object.entries(outcomes)]} onChange={(v) => {setResult(v); setPage(0);}}/>
        <FixtureSelect label="时间范围" value={window} options={[["all", "不限时间"], ["7", "最近 7 天"], ["1", "最近 24 小时"]]} onChange={(v) => {setWindow(v); setPage(0);}}/>
      </div>
      <Panel title="最近操作记录" action={<span className="fixture-meta">CST · 北京时间</span>} className="fixture-table audit-fixtures">
        <div className="fixture-scroll" tabIndex={0} role="region" aria-label="审计记录表格">
          {visible.length ? <DemoTable label="最近审计事件" columns={columns} rows={visible.map((event) => {
            const row = display(event);
            const ok = event.outcome === "succeeded";
            return [
              <code key="time">{row.time}</code>,
              <code key="actor">{row.actor}</code>,
              <Badge key="category" variant="outline">{row.category}</Badge>,
              <div key="action"><b>{row.action}</b><small className="mono">{row.target}</small></div>,
              <Badge key="result" variant={ok ? "success" : "danger"}>{ok ? <Check aria-hidden="true"/> : <X aria-hidden="true"/>}{row.outcome}</Badge>,
            ];
          })}/> : <p className="empty-panel">{events.length ? "没有符合条件的记录。" : "尚无操作审计记录。"}</p>}
        </div>
        <div className="fixture-table-footer">
          <span><Info aria-hidden="true"/>仅显示并导出最近 100 条事件范围内的结果。</span>
          <FixturePager page={page} total={matches.length} size={7} unit="条审计记录" change={setPage}/>
        </div>
      </Panel>
    </>}
  </div>;
}
