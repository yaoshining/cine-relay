import Link from "next/link";
import { Activity, ArrowUpRight, Film, KeyRound, TriangleAlert } from "lucide-react";
import { PageHead, Panel, Relay, HitChart, DocsLink, MovieTile, PoolRows } from "@/components/console";
import { OverviewActions, QuickTry } from "@/components/quick-actions";
import { movies } from "@/lib/demo";
export default function Overview(){
  return <div className="page-flow overview">
    <PageHead title="运营总览" action={<OverviewActions/>}><span className="budget-indicator"><i/>共享预算 <b className="mono">2/2</b></span></PageHead>
    <div className="demo-strip"><span><span className="demo-kicker">1.1 视觉骨架</span> 合成数据 · 不连接 Neon / TMDB</span><span className="mono">SNAPSHOT · 09:42 CST</span></div>
    <div className="overview-row overview-row-top">
      <Panel title={<><Activity className="heading-icon"/>实时同步流水线 <span className="title-extra">· 每日电影增量 <span className="mono">#0142</span></span></>} action={<Link href="/runs" className="icon-link" aria-label="查看运行历史"><ArrowUpRight/></Link>} className="relay-card"><Relay/></Panel>
      <Panel title={<>快速试抓 <span className="title-extra"> / Dry-Run</span></>}><QuickTry/></Panel>
    </div>
    <div className="overview-row overview-row-bottom">
      <Panel title={<><KeyRound className="heading-icon"/>TMDB 凭据池 <span className="title-extra"> / 并发预算</span></>} action={<Link className="icon-link" href="/credentials" aria-label="查看 TMDB 凭据池"><ArrowUpRight/></Link>}><PoolRows/><p className="pool-warning"><TriangleAlert aria-hidden="true"/>退避保护开启 · 尊重 Retry-After</p></Panel>
      <Panel title={<>VidAll 外部 API <span className="title-extra mono">/docs/api</span></>}><code className="endpoint">GET /api/v1/movies/&#123;tmdbId&#125;?lang=zh-CN</code><HitChart/><DocsLink/></Panel>
    </div>
    <Panel title={<><Film className="heading-icon"/>最近入库电影 <span className="title-extra mono">zh-CN</span></>} action={<Link className="text-link" href="/movies">电影库 <ArrowUpRight aria-hidden="true"/></Link>}>
     <div className="poster-grid recent-posters">{movies.slice(0,6).map(movie=><MovieTile key={movie.id} movie={movie}/>)}</div>
    </Panel>
  </div>;
}
