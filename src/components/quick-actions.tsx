"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { Search, FlaskConical, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
export function OverviewActions(){
  const search=useRef<HTMLInputElement>(null);
  useEffect(()=>{ const key=(event:KeyboardEvent)=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==="k"){event.preventDefault();search.current?.focus();}};window.addEventListener("keydown",key);return()=>window.removeEventListener("keydown",key);},[]);
  return <><form className="quick-search" action="/movies"><Search aria-hidden="true"/><Input id="quick-search" ref={search} autoComplete="off" name="q" aria-label="搜索电影库" placeholder="检索影片或 TMDB ID"/><kbd>⌘ K</kbd></form><Button asChild variant="signal"><Link href="/jobs?sample=1"><FlaskConical data-icon="inline-start"/>试抓 5 部</Link></Button><Button asChild><Link href="/jobs#builder"><Plus data-icon="inline-start"/>新建任务</Link></Button></>;
}
export function Options({label,items,value,onChange}:{label:string;items:readonly [string,string][];value?:string;onChange?:(s:string)=>void}){
  return <Select defaultValue={value===undefined?items[0][0]:undefined} value={value} onValueChange={onChange}><SelectTrigger aria-label={label} className="w-full"><SelectValue placeholder={label}/></SelectTrigger><SelectContent><SelectGroup>{items.map(([id,name])=><SelectItem key={id} value={id}>{name}</SelectItem>)}</SelectGroup></SelectContent></Select>;
}
export function QuickTry(){
  return <form action="/jobs" className="quick-try">
    <input type="hidden" name="sample" value="1"/>
    <label className="sr-only" htmlFor="quick-year">上映年份</label><select id="quick-year" name="year" className="native-control"><option>2026</option><option>2025</option><option>2024</option></select>
    <label className="sr-only" htmlFor="quick-genre">电影类别</label><select id="quick-genre" name="genre" className="native-control"><option value="drama">剧情 / 科幻</option><option value="all">全部类别</option></select>
    <label className="sr-only" htmlFor="quick-locale">译文语言</label><select id="quick-locale" name="locale" className="native-control"><option>zh-CN</option><option>en-US</option></select>
    <span className="muted-slot">最多 5 部 · 不入库</span>
    <Button variant="signal" className="col-span-2" type="submit"><FlaskConical data-icon="inline-start"/>立即试抓 5 部</Button>
  </form>;
}
