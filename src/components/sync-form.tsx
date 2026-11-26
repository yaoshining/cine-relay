"use client";

import { useActionState, useState } from "react";
import { FlaskConical, Save } from "lucide-react";
import { submitSyncForm } from "@/lib/sync/actions";
import type { SyncConfig } from "@/lib/sync/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Callout, Panel } from "@/components/console";

const genres = [[18, "剧情"], [878, "科幻"], [16, "动画"], [28, "动作"], [35, "喜剧"], [53, "惊悚"], [10749, "爱情"]] as const;
const weekdays = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

export function SyncForm({ id, config, configured }: { id?: string; config: SyncConfig; configured: boolean }) {
  const [state, action, pending] = useActionState(submitSyncForm.bind(null, id ?? null), {});
  const [schedule, setSchedule] = useState(config.schedule.kind);
  const { selection } = config;

  return <div className="split builder-split">
    <Panel title="任务参数配置">
      <form action={action} className="in-card-stack">
        <fieldset disabled={pending} className="in-card-stack">
          <label className="control-label">模板名称<Input name="name" required maxLength={120} defaultValue={config.name}/></label>
          <label className="control-label">同步模式<select name="mode" className="native-control" defaultValue={config.mode}><option value="backfill">一次性回填</option><option value="incremental">增量同步（试抓使用选片范围）</option></select></label>
          <div className="control-grid">
            <label className="control-label">上映日期起<Input name="releaseFrom" type="date" required defaultValue={selection.releaseFrom}/></label>
            <label className="control-label">上映日期止<Input name="releaseThrough" type="date" required defaultValue={selection.releaseThrough}/></label>
          </div>
          <fieldset className="flex flex-wrap gap-3"><legend className="control-label mb-2">电影类别（任选；不选为不限）</legend>
            {genres.map(([value,label]) => <label key={value} className="flex items-center gap-2 text-sm">
              <input name="genreId" type="checkbox" value={value} defaultChecked={selection.genreIds.includes(value)}/>{label}
            </label>)}
          </fieldset>
          <div className="control-grid">
            <label className="control-label">原片语言<select name="originalLanguage" defaultValue={selection.originalLanguage ?? ""} className="native-control">
              <option value="">不限</option><option value="zh">中文</option><option value="en">英语</option><option value="ja">日语</option><option value="ko">韩语</option><option value="fr">法语</option>
            </select></label>
            <label className="control-label">译文语言<select name="locale" defaultValue={selection.locale} className="native-control"><option value="zh-CN">简体中文 zh-CN</option><option value="en-US">英语 en-US</option></select></label>
            <label className="control-label">字段组<select name="fieldGroup" className="native-control" defaultValue="movie_details"><option value="movie_details">电影基础详情与译文</option></select></label>
            <label className="control-label">单次上限（部）<Input name="limit" type="number" min={1} max={500} required defaultValue={selection.limit}/></label>
          </div>
          <label className="control-label">运行计划<select name="schedule" value={schedule} onChange={(event) => setSchedule(event.target.value as SyncConfig["schedule"]["kind"])} className="native-control">
            <option value="manual">手动</option><option value="daily">每日</option><option value="weekly">每周</option>
          </select></label>
          {schedule !== "manual" && <div className="control-grid">
            <label className="control-label">触发小时（北京时间）<select name="hour" className="native-control" defaultValue={config.schedule.kind === "manual" ? 9 : config.schedule.hour}>
              {Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour}>{String(hour).padStart(2,"0")}:00</option>)}
            </select></label>
            {schedule === "weekly" && <label className="control-label">星期<select name="weekday" className="native-control" defaultValue={config.schedule.kind === "weekly" ? config.schedule.weekday : 1}>
              {weekdays.map((day, index) => <option key={day} value={index + 1}>{day}</option>)}
            </select></label>}
          </div>}
          {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button name="intent" value="save" type="submit"><Save data-icon="inline-start" aria-hidden="true"/>保存模板</Button>
            <Button name="intent" value="sample" type="submit" variant="signal" disabled={!configured}><FlaskConical data-icon="inline-start" aria-hidden="true"/>试抓最多 5 部</Button>
          </div>
        </fieldset>
        {pending && <p role="status" className="text-sm text-muted-foreground">正在提交…</p>}
      </form>
    </Panel>
    <Panel title="试抓与运行安排">
      <div className="in-card-stack">
        <Callout tone="signal">试抓使用当前表单，不必先保存。最多抓取 5 部，只保存运行诊断，不写入电影缓存或推进游标。</Callout>
        {!configured && <Callout warning>尚未配置 Inngest 或 TMDB，试抓暂不可用。仍可保存模板。</Callout>}
        <p className="text-sm text-muted-foreground">提交后可在运行详情查看结果。正式同步使用已保存的模板，增量模式需要先初始化游标。</p>
      </div>
    </Panel>
  </div>;
}
