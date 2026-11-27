import Link from "next/link";
import { Clapperboard, LayoutGrid, List, Search } from "lucide-react";
import { CacheMoviePoster } from "@/components/cache-movie-poster";
import { CacheMovieStatus } from "@/components/cache-movie";
import { Callout } from "@/components/console";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { cacheStates, catalogHref, movieCacheHref, type CatalogFilters } from "@/lib/movie-catalog";
import type { MovieCatalogPage } from "@/lib/db/movie-catalog";

export function Catalog({ filters, result }: { filters: CatalogFilters; result: MovieCatalogPage | null }) {
  const entries = result?.entries ?? [];
  return <div className="page-flow">
    <header className="page-head catalog-head">
      <div className="page-title-row"><h1>电影库</h1><p>只读查询 Neon 缓存 · 不触发 TMDB 回源</p></div>
      <div className="page-actions">
        {result && <span className="cache-count">本页 {entries.length} 条缓存</span>}
        <nav className="flex gap-1" aria-label="电影展示方式">
          <Button variant={filters.view === "grid" ? "signal" : "outline"} size="icon" asChild><Link href={catalogHref(filters, { view: "grid" })} prefetch={false} aria-current={filters.view === "grid" ? "true" : undefined} aria-label="海报网格"><LayoutGrid aria-hidden="true"/></Link></Button>
          <Button variant={filters.view === "list" ? "signal" : "outline"} size="icon" asChild><Link href={catalogHref(filters, { view: "list" })} prefetch={false} aria-current={filters.view === "list" ? "true" : undefined} aria-label="表格列表"><List aria-hidden="true"/></Link></Button>
        </nav>
      </div>
    </header>
    <form action="/movies" method="get" className="flex flex-col gap-2">
      {filters.view !== "grid" && <input type="hidden" name="view" value={filters.view}/>}
      <div className="catalog-controls">
        <label className="catalog-search self-end"><Search aria-hidden="true"/><span className="sr-only">片名或 TMDB ID</span><Input name="q" type="search" defaultValue={filters.query} maxLength={120} placeholder="搜索片名或 TMDB ID"/></label>
        <label className="control-label">译文语言<select name="lang" className="native-control w-full" defaultValue={filters.locale ?? ""}><option value="">全部语言</option><option value="zh-CN">简体中文 zh-CN</option><option value="en-US">英语 en-US</option></select></label>
        <label className="control-label">缓存状态<select name="state" className="native-control w-full" defaultValue={filters.state ?? ""}><option value="">全部状态</option>{Object.entries(cacheStates).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label className="control-label">排序<select name="sort" className="native-control w-full" defaultValue={filters.sort}><option value="recent">最近同步</option><option value="title">片名</option></select></label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit"><Search data-icon="inline-start" aria-hidden="true"/>应用筛选</Button>
        <Button variant="ghost" asChild><Link href="/movies" prefetch={false}>清除筛选</Link></Button>
      </div>
    </form>
    {!result ? <Callout warning>暂时无法读取电影缓存。请检查数据库连接和迁移状态后重试。</Callout>
      : entries.length === 0 ? <div className="empty-panel"><Clapperboard aria-hidden="true"/><strong>没有匹配的缓存记录</strong><p>试试其他片名或 TMDB ID，或清除筛选条件。</p></div>
      : filters.view === "grid" ? <div className="poster-grid catalog-posters">
        {entries.map((movie) => {
          const href = movieCacheHref(movie.tmdbId, movie.locale);
          return <article className="movie-tile" key={`${movie.tmdbId}:${movie.locale}`}>
            <Link href={href} prefetch={false} className="poster-link" aria-label={`查看 ${movie.title}（${movie.locale}）`}><CacheMoviePoster path={movie.posterPath}/></Link>
            <div className="movie-tile-title"><h3><Link href={href} prefetch={false}>{movie.title}</Link></h3><span className="mono">{movie.releaseDate?.slice(0,4) ?? "—"}</span></div>
            <div className="movie-meta"><span className="mono">#{movie.tmdbId}</span><Badge variant="secondary">{movie.locale}</Badge><CacheMovieStatus status={movie.status}/></div>
          </article>;
        })}
      </div> : <div className="table-surface" role="region" aria-label="电影缓存结果" tabIndex={0}>
        <Table><TableHeader><TableRow><TableHead>影片</TableHead><TableHead>年份</TableHead><TableHead>TMDB ID</TableHead><TableHead>语言</TableHead><TableHead>缓存</TableHead></TableRow></TableHeader>
          <TableBody>{entries.map((movie) => <TableRow key={`${movie.tmdbId}:${movie.locale}`}>
            <TableCell><Link className="text-link" href={movieCacheHref(movie.tmdbId, movie.locale)} prefetch={false}>{movie.title}</Link></TableCell>
            <TableCell>{movie.releaseDate?.slice(0,4) ?? "—"}</TableCell><TableCell className="mono">#{movie.tmdbId}</TableCell><TableCell>{movie.locale}</TableCell><TableCell><CacheMovieStatus status={movie.status}/></TableCell>
          </TableRow>)}</TableBody>
        </Table>
      </div>}
    {result && (filters.page > 1 || result.hasNext) && <nav className="flex items-center gap-3" aria-label="电影分页">
      {filters.page > 1 && <Button variant="outline" asChild><Link href={catalogHref(filters, { page: filters.page - 1 })} prefetch={false}>上一页</Link></Button>}
      <span className="mono text-sm">第 {filters.page} 页</span>
      {result.hasNext && <Button variant="outline" asChild><Link href={catalogHref(filters, { page: filters.page + 1 })} prefetch={false}>下一页</Link></Button>}
    </nav>}
  </div>;
}
