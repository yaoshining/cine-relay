import Link from "next/link";
import { ArrowUpRight, Check, CircleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Poster } from "@/components/poster";
import { type Movie, completion, number, phases } from "@/lib/demo";

export function PageHead({title,sub,action,children}:{title:string;sub?:string;action?:ReactNode;children?:ReactNode}){
  return <header className="page-head"><div><div className="page-title-row"><h1>{title}</h1>{children}</div>{sub&&<p>{sub}</p>}</div>{action&&<div className="page-actions">{action}</div>}</header>;
}
export function Panel({title,sub,action,children,className}:{title:ReactNode;sub?:string;action?:ReactNode;children:ReactNode;className?:string}){
  return <Card className={className}><CardHeader><div className="panel-title"><CardTitle className="text-base sm:text-lg">{title}</CardTitle>{action}</div>{sub&&<CardDescription>{sub}</CardDescription>}</CardHeader><CardContent>{children}</CardContent></Card>;
}
export function Callout({children,warning=false,tone}:{children:ReactNode;warning?:boolean;tone?:"signal"}){
  return <div className={warning?"callout callout-warning":tone?"callout callout-signal":"callout"}><CircleAlert aria-hidden="true"/><span>{children}</span></div>;
}
export function DemoStrip({children}:{children:ReactNode}){
  return <div className="demo-strip"><span><span className="demo-kicker">1.1 静态演示</span>{children}</span></div>;
}
export function Relay({full=false}:{full?:boolean}){
  return <><div className="relay-total"><strong>{completion}%</strong><span><b>{number(phases[3].count)} / {number(phases[0].count)}</b> 已入库</span><Badge variant="warning">2 失败待重试</Badge></div>
    <ol className="relay-track" aria-label="模拟同步进度">{phases.map(({label,count},i)=><li key={label}><span className="relay-node" data-index={i} aria-hidden="true"/><span>{label}</span><b>{number(count)}</b></li>)}</ol>
    {full&&<p className="relay-note">当前并发批次 <code>2 / 2</code> · 按 <code>(tmdb_id, locale)</code> 幂等去重 · 仅更新更晚 <code>fetched_at</code></p>}</>;
}
function MovieStatus({movie}:{movie:Movie}){
  return movie.status==="新鲜"?<span className="movie-status fresh"><Check aria-hidden="true"/>{movie.status}</span>:<span className="movie-status expired"><CircleAlert aria-hidden="true"/>{movie.status}</span>;
}
export function MovieTile({movie}:{movie:Movie}){
  return <article className="movie-tile"><div className="poster-link"><Poster movie={movie}/></div>
    <div className="movie-tile-title"><h3>{movie.title}</h3><span className="mono">{movie.year}</span></div><div className="movie-meta"><span className="mono">#{movie.id}</span><Badge variant="secondary">{movie.locale}</Badge><MovieStatus movie={movie}/></div></article>;
}
export function HitChart({compact=false}:{compact?:boolean}){
  return <div className={compact?"hit-chart hit-chart-compact":"hit-chart"}><svg viewBox="0 0 420 75" role="img" aria-label="示例缓存命中率曲线，当前为 98.4%" preserveAspectRatio="none"><defs><linearGradient id="hit-fill" x2="0" y2="1"><stop stopColor="var(--signal)" stopOpacity=".28"/><stop offset="1" stopColor="var(--signal)" stopOpacity=".015"/></linearGradient></defs><path d="M0 67H420M0 43H420M0 20H420" stroke="var(--border)" fill="none"/><path d="M0 62C23 63 40 61 58 56S82 31 103 38 128 50 155 37 181 25 214 39 247 40 273 24 300 17 330 29 362 40 386 24 405 26 420 17V75H0Z" fill="url(#hit-fill)"/><path d="M0 62C23 63 40 61 58 56S82 31 103 38 128 50 155 37 181 25 214 39 247 40 273 24 300 17 330 29 362 40 386 24 405 26 420 17" fill="none" stroke="var(--signal)" strokeWidth="2" vectorEffect="non-scaling-stroke"/></svg>{!compact&&<div><b>98.4%</b><span>缓存命中率</span></div>}</div>;
}
export function PoolRows(){
  return <><ul className="pool-rows" aria-label="脱敏凭据"><li><code>tmdb_••••_9f2a</code><Switch className="snapshot-switch" size="sm" checked disabled aria-label="主凭据已启用"/><Badge variant="warning">共享冷却</Badge></li><li><code>tmdb_••••_4c81</code><Switch className="snapshot-switch" size="sm" checked={false} disabled aria-label="备用凭据待命"/><Badge variant="outline">待命</Badge></li></ul><div className="budget-row"><span>共享预算</span><span className="budget-bar" aria-hidden="true">{Array.from({length:5},(_,i)=><i key={i}/>)}</span><b className="mono">2 / 2</b></div></>;
}
export function DocsLink(){return <Link className="text-link" href="/docs/api">查看 Scalar 文档 <ArrowUpRight aria-hidden="true"/></Link>}
