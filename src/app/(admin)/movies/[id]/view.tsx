import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Check } from "lucide-react";
import { DemoStrip, Panel } from "@/components/console";
import { Poster } from "@/components/poster";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { movies } from "@/lib/demo";

export default async function MoviePage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 const movie=movies.find(m=>m.id===id);
 if(!movie)notFound();
 const stale=movie.status==="已过期";
 const dates=stale?["11-16","11-23","12-16"]:["11-26","12-03","12-26"];
 const fields={tmdbId:Number(id),title:movie.title,locale:movie.locale,cache:stale?"stale":"hit",stale};
 return <div className="page-flow">
  <header className="page-head"><nav aria-label="面包屑" className="breadcrumbs"><Link className="text-link" href="/movies"><ArrowLeft aria-hidden="true"/>返回电影库</Link><span aria-hidden="true">/</span><span>电影详情 <code>#{id}</code></span></nav><div className="page-actions"><Badge variant="outline">只读缓存视图</Badge><Button variant="outline" asChild><Link href="/docs/api">在 API 文档中调试<ArrowUpRight data-icon="inline-end"/></Link></Button></div></header>
  <DemoStrip>合成记录 · 不连接生产数据库</DemoStrip>
  <div className="split movie-detail">
   <aside className="in-card-stack" aria-label="影片元信息"><Poster movie={movie}/><div className="movie-facts"><span>{movie.year}</span><span>{movie.genre}</span><span>原片语言: <code>{movie.language}</code></span><span>{movie.runtime} 分钟</span></div></aside>
   <Tabs defaultValue="zh" className="in-card-stack">
    <div className="detail-heading"><div className="detail-heading-row"><div><h1>{movie.title}</h1><p>{movie.en}</p></div><code>TMDB ID #{id}</code></div><TabsList className="locale-tabs" aria-label="译文语言"><TabsTrigger value="zh">简体中文 zh-CN</TabsTrigger><TabsTrigger value="en">English en-US</TabsTrigger></TabsList></div>
    <Panel title="缓存生命周期状态" className="wrap-panel-header" action={<div className="page-actions"><span className={`cache-stage ${stale?"expired":"fresh"}`}><i/>{stale?"已过期 · 剩余保留 19 天":"新鲜 · 剩余 6 天"}</span><Badge variant="secondary">未下架</Badge></div>}><ol className="lifecycle" data-fresh={!stale}>{["抓取时间","7 天过期","30 天保留"].map((label,i)=><li key={label}><b>{label}</b><time dateTime={`2026-${dates[i]}`} className="mono">2026-{dates[i]}</time></li>)}</ol></Panel>
    <div className="split detail-bottom">
     <Panel title="译文简介与抓取字段">
      <TabsContent value="zh"><p className="movie-overview">{movie.overview}</p><div className="coverage">{["基础详情","中文译文","海报路径"].map(field=><Badge key={field} variant="success"><Check aria-hidden="true"/>{field}</Badge>)}</div></TabsContent>
      <TabsContent value="en"><p className="movie-overview text-muted-foreground">演示快照未缓存英语译文。</p></TabsContent>
     </Panel>
     <Panel title="VidAll 接口返回预览"><code className="endpoint">GET /api/v1/movies/{id}?lang=zh-CN</code><pre className="code-block json-preview"><code>{"{\n"}{Object.entries(fields).map(([key,value],i)=><span key={key}>{"  "}<span className="json-key">{JSON.stringify(key)}</span>{": "}<span data-type={typeof value}>{JSON.stringify(value)}</span>{i===Object.keys(fields).length-1?"\n":",\n"}</span>)}{"}"}</code></pre></Panel>
    </div>
   </Tabs>
  </div>
 </div>;
}
