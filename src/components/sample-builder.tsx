"use client";
import { ArrowRight, FlaskConical, Check, Clock3, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Callout, Panel } from "@/components/console";
import { NativeOption, DemoButton, Segmented } from "@/components/static-controls";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Poster } from "@/components/poster";
import { movies } from "@/lib/demo";

const runMessage="静态演示 · 未写入数据库或触发调度。";
export function SampleBuilder({showSample,locale,year,genre,initialMode="once",initialSchedule="manual",originalLanguage="any",yearLabel}:{showSample:boolean;locale:string;year:string;genre:string;initialMode?:string;initialSchedule?:string;originalLanguage?:string;yearLabel?:string}){
 const [visible,setVisible]=useState(showSample),[schedule,setSchedule]=useState(initialSchedule),[mode,setMode]=useState(initialMode);
 return <div id="builder" className="split builder-split">
 <Panel title="任务参数配置"><div className="in-card-stack">
 <div className="builder-section"><h2 className="subheading">01 选片与内容</h2><Segmented name="mode" label="同步模式" options={[["once","一次性回填"],["inc","增量同步"]]} value={mode} onChange={setMode}/></div>
 <NativeOption label="上映年份" options={[...(yearLabel?[[yearLabel,yearLabel] as const]:[]),["2026","2026"],["2025","2025"],["2024","2024"]]} initialValue={yearLabel??year}/>
 <div className="control-grid"><NativeOption label="电影类别" options={[["drama","剧情 / 科幻"],["all","全部类别"],["animation","动画"]]} initialValue={genre}/><NativeOption label="原片语言" options={[["any","不限"],["en","英语"],["zh","中文"],["ja","日语"]]} initialValue={originalLanguage}/>
 <NativeOption label="译文语言" options={[["zh-CN","简体中文 zh-CN"],["en-US","英语 en-US"]]} initialValue={locale}/><NativeOption label="字段组" options={[["details","基础详情与译文"],["metadata","基础详情"]]}/></div>
 <Separator/><h2 className="subheading">02 运行安排</h2>
 <Segmented name="schedule" label="执行方式" value={schedule} onChange={setSchedule} options={[["manual","手动立即运行"],["daily","每日定时"],["weekly","每周定时"]]}/>
 <div className="control-grid schedule-grid">{schedule==="manual"?<label className="control-label">计划时间<Input readOnly value="09:00 · Asia/Shanghai (北京时间)" aria-describedby="manual-note"/><span id="manual-note" className="sr-only">手动模式不使用计划时间，此处为默认预览</span></label>:<NativeOption label="计划时间" options={[["03","03:00 · Asia/Shanghai (北京时间)"],["09","09:00 · Asia/Shanghai (北京时间)"],["10","10:00 · Asia/Shanghai (北京时间)"],["18","18:00 · Asia/Shanghai (北京时间)"]]} initialValue={initialSchedule==="weekly"?"03":"09"}/>}<label className="control-label">单次上限（部）<Input type="number" min={1} defaultValue={250}/></label>
 {schedule==="weekly"&&<NativeOption label="星期" options={["周一","周二","周三","周四","周五","周六","周日"].map((s,i)=>[String(i),s])} initialValue={initialSchedule==="weekly"?"6":"0"}/>}</div>
 <div className="builder-buttons"><Button variant="signal" onClick={()=>setVisible(true)}><FlaskConical data-icon="inline-start"/>试抓 5 部（不写库）</Button><DemoButton indigoOutline wide message={runMessage}>立即正式运行</DemoButton></div>
 </div></Panel>
 <Panel title={<>试抓结果 <span className="title-extra mono">· SAMPLE #0023</span></>}><div className="in-card-stack"><Callout tone="signal">最多 5 部 · 不写库 · 不推进游标</Callout>
 {visible?<><div className="sample-stats">{[["抽样",5,""],["成功",4,"fresh"],["写入库",0,""],["失败",1,"error-text"]].map(([name,n,css])=><div key={name}><span>{name}</span><b className={String(css)}>{n}</b></div>)}</div>
 <ul className="sample-items">{movies.slice(0,5).map((m,i)=><li key={m.id}><span className="sample-thumb"><Poster movie={m} crop/></span><span>{m.title}</span>{i===4?<Badge variant="danger"><Clock3/>上游请求超时</Badge>:i===3?<Badge variant="warning"><TriangleAlert/>译文回退 en-US</Badge>:<Badge variant="success"><Check/>中文标题与简介完整</Badge>}</li>)}</ul><p className="text-xs text-muted-foreground">固定诊断样本，未调用 TMDB。</p></>:<p className="empty-panel">点击「试抓 5 部」查看静态样本与诊断状态。</p>}
 <DemoButton primary wide message={runMessage}>使用此配置正式运行<ArrowRight data-icon="inline-end"/></DemoButton>
 </div></Panel></div>;
}
