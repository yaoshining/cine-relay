"use client";
import Link from "next/link";
import { useState } from "react";
import { LayoutGrid, List, Search } from "lucide-react";
import { DemoStrip, EmptyMovies, MovieStatus, MovieTile } from "@/components/console";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table,TableHeader,TableBody,TableHead,TableRow,TableCell } from "@/components/ui/table";
import { filterMovies, movies } from "@/lib/demo";

function Filter({label,options,value,onChange}:{label:string;options:string[][];value:string;onChange:(v:string)=>void}){
 return <select className="native-control" aria-label={label} value={value} onChange={e=>onChange(e.target.value)}>{options.map(([k,v])=><option key={k} value={k}>{v}</option>)}</select>;
}
export function Catalog({initialQuery}:{initialQuery:string}){
 const [query,setQuery]=useState(initialQuery),[state,setState]=useState("all"),[locale,setLocale]=useState("all"),[sort,setSort]=useState("recent");
 const matches=filterMovies(query,state,sort,locale);
 return <Tabs className="page-flow" defaultValue="grid">
  <header className="page-head catalog-head"><div className="page-title-row"><h1>电影库</h1><p>只读查询 Neon 缓存 · 不触发 TMDB 回源</p></div><div className="page-actions"><span className="cache-count">共 1,280 部已缓存 · 示例 {movies.length} 部</span><TabsList className="view-options" aria-label="电影展示方式"><TabsTrigger title="海报网格" aria-label="海报网格" value="grid"><LayoutGrid aria-hidden="true"/></TabsTrigger><TabsTrigger title="表格列表" aria-label="表格列表" value="list"><List aria-hidden="true"/></TabsTrigger></TabsList></div></header>
  <DemoStrip>仅使用本地合成影片</DemoStrip>
  <div className="catalog-controls"><label className="catalog-search"><Search aria-hidden="true"/><Input type="search" aria-label="片名或 TMDB ID" value={query} onChange={e=>setQuery(e.target.value)} placeholder="搜索片名或 TMDB ID，例如 438631"/></label>
  <Filter label="译文语言" options={[["all","全部语言"],["zh-CN","简体中文 zh-CN"],["en-US","英语 en-US"]]} value={locale} onChange={setLocale}/>
  <Filter label="缓存状态" options={[["all","全部状态"],["新鲜","新鲜"],["已过期","已过期"]]} value={state} onChange={setState}/>
  <Filter label="排序" options={[["recent","最近同步"],["title","片名"]]} value={sort} onChange={setSort}/></div>
  <p className="sr-only" aria-live="polite">{matches.length} 条示例记录</p>
  <TabsContent value="grid">{matches.length?<div className="poster-grid catalog-posters">{matches.map(movie=><MovieTile key={movie.id} movie={movie}/>)}</div>:<EmptyMovies/>}</TabsContent>
  <TabsContent value="list">{matches.length?<div className="table-surface"><Table><TableHeader><TableRow><TableHead>影片</TableHead><TableHead>年份</TableHead><TableHead>TMDB ID</TableHead><TableHead>语言</TableHead><TableHead>缓存</TableHead></TableRow></TableHeader><TableBody>{matches.map(m=><TableRow key={m.id}><TableCell><Link className="text-link" href={`/movies/${m.id}`}>{m.title}</Link></TableCell><TableCell>{m.year}</TableCell><TableCell className="mono">#{m.id}</TableCell><TableCell>{m.locale}</TableCell><TableCell><MovieStatus movie={m}/></TableCell></TableRow>)}</TableBody></Table></div>:<EmptyMovies/>}</TabsContent>
 </Tabs>;
}
