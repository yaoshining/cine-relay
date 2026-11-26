"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Clapperboard, FileSearch, Globe2, History, House, KeyRound, Menu, Settings } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { BrandMark, GitHubMark } from "@/components/brand";
import { navigation } from "@/lib/demo";
const icons = [House, Settings, History, Clapperboard, KeyRound, Globe2, FileSearch, BookOpen];
function Nav({ path, onNavigate }:{path:string;onNavigate?:()=>void}) {
  return <nav aria-label="管理后台" className="side-nav">{navigation.map(([href,label],index)=>{
    const Icon=icons[index]; const current=href==="/" ? path==="/" : path===href || path.startsWith(href+"/");
    return <Link key={href} href={href} onClick={onNavigate} aria-current={current?"page":undefined} className="nav-link"><Icon aria-hidden="true"/>{label}</Link>;
  })}</nav>;
}
function Identity(){return <Link href="/login" className="identity"><GitHubMark/>受邀管理员 · GitHub</Link>}
export function AppShell({children}:{children:ReactNode}){
  const path=usePathname(); const [open,setOpen]=useState(false);
  if(path==="/login") return <main id="content">{children}</main>;
  return <><a className="skip" href="#content">跳转到主要内容</a><aside className="sidebar">
    <Link href="/" className="wordmark"><BrandMark/>CineRelay</Link><Nav path={path}/><Identity/>
  </aside><div className="mobile-head"><Link href="/" className="wordmark"><BrandMark/>CineRelay</Link>
    <Sheet open={open} onOpenChange={setOpen}><SheetTrigger asChild><Button variant="outline" size="icon" aria-label="打开导航"><Menu aria-hidden="true"/></Button></SheetTrigger>
    <SheetContent side="left" className="mobile-sheet"><SheetHeader><SheetTitle>CineRelay</SheetTitle><SheetDescription>管理后台导航</SheetDescription></SheetHeader><Nav path={path} onNavigate={()=>setOpen(false)}/><Identity/></SheetContent></Sheet>
  </div><main id="content" className="main-area">{children}</main></>;
}
