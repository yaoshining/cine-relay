import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Check } from "lucide-react";
import { CacheMoviePoster } from "@/components/cache-movie-poster";
import { CacheMovieStatus } from "@/components/cache-movie";
import { Callout, Panel } from "@/components/console";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { MovieCatalogDetail } from "@/lib/db/movie-catalog";
import { movieLocales, type MovieLocale } from "@/lib/db/schema";
import { movieCacheHref } from "@/lib/movie-catalog";

const dateTime = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit",
});

function Timestamp({ value }: { value: string }) {
  // PostgreSQL can omit the minutes on a whole-hour UTC offset.
  const normalized = value.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00");
  const date = new Date(normalized);
  return Number.isFinite(date.getTime())
    ? <time dateTime={date.toISOString()} className="mono">{dateTime.format(date)}</time>
    : <span className="mono">{value}</span>;
}

const genres: Record<number, string> = {
  12: "冒险", 14: "奇幻", 16: "动画", 18: "剧情", 27: "恐怖", 28: "动作", 35: "喜剧",
  36: "历史", 37: "西部", 53: "惊悚", 80: "犯罪", 99: "纪录", 878: "科幻",
  9648: "悬疑", 10402: "音乐", 10749: "爱情", 10751: "家庭", 10752: "战争", 10770: "电视电影",
};

export function MovieCacheDetail({ detail, locale }: { detail: MovieCatalogDetail; locale?: MovieLocale }) {
  const { movie, localizations } = detail;
  const { tmdbId } = movie;
  const active = locale ?? (localizations.some((record) => record.locale === "zh-CN") ? "zh-CN" : localizations[0]?.locale ?? "zh-CN");
  const record = localizations.find((entry) => entry.locale === active);
  const coverage = ["基础详情", record && "译文标题", record?.overview && "译文简介", record?.posterPath && "海报路径"].filter(Boolean);
  return <div className="page-flow">
    <header className="page-head">
      <nav aria-label="面包屑" className="breadcrumbs"><Link className="text-link" href="/movies"><ArrowLeft aria-hidden="true"/>返回电影库</Link><span aria-hidden="true">/</span><span>电影详情 <code>#{tmdbId}</code></span></nav>
      <div className="page-actions"><Badge variant="outline">只读缓存视图</Badge><Button variant="outline" asChild><Link href="/docs/api">查看 API 文档<ArrowUpRight data-icon="inline-end" aria-hidden="true"/></Link></Button></div>
    </header>
    <div className="split movie-detail">
      <aside className="in-card-stack" aria-label="影片元信息">
        <CacheMoviePoster path={record?.posterPath} full/>
        <div className="movie-facts"><span>{movie.releaseDate?.slice(0,4) ?? "年份未缓存"}</span><span>{movie.genreIds.map((id) => genres[id] ?? `#${id}`).join(" / ") || "类型未缓存"}</span><span>原片语言：<code>{movie.originalLanguage ?? "未缓存"}</code></span><span>{movie.runtimeMinutes === null ? "片长未缓存" : `${movie.runtimeMinutes} 分钟`}</span></div>
      </aside>
      <div className="in-card-stack">
        <div className="detail-heading">
          <div className="detail-heading-row"><div><h1>{record?.title ?? movie.originalTitle ?? `电影 #${tmdbId}`}</h1>{movie.originalTitle && movie.originalTitle !== record?.title && record && <p>{movie.originalTitle}</p>}</div><code>TMDB ID #{tmdbId}</code></div>
          <nav aria-label="译文语言" className="flex flex-wrap gap-2">{movieLocales.map((language) => (
            <Button key={language} variant={language === active ? "signal" : "outline"} size="sm" asChild>
              <Link href={movieCacheHref(tmdbId, language)} prefetch={false} aria-current={language === active ? "page" : undefined}>{language === "zh-CN" ? "简体中文 zh-CN" : "English en-US"}</Link>
            </Button>
          ))}</nav>
        </div>
        <Panel title="缓存生命周期状态" sub="北京时间（UTC+8）" className="wrap-panel-header"
          action={<div className="page-actions">{record && !movie.removedAt && <CacheMovieStatus status={record.status}/>}<Badge variant={movie.removedAt ? "danger" : "secondary"}>{movie.removedAt ? "已下架" : "未标记下架"}</Badge></div>}>
          {movie.removedAt && <p className="mb-3 text-sm">下架时间：<Timestamp value={movie.removedAt}/></p>}
          {record ? <ol className="lifecycle" data-fresh={record.status === "fresh"}>
            {([["抓取时间", record.fetchedAt], ["过期时间", record.expiresAt], ["保留截止", record.purgeAfter]] as const).map(([label,value]) => <li key={label}><b>{label}</b><Timestamp value={value}/></li>)}
          </ol> : <Callout>该语言尚无缓存，不会触发补抓或回退到其他译文。</Callout>}
        </Panel>
        <div className="split detail-bottom">
          <Panel title="译文简介与抓取字段">
            <p className="movie-overview">{record?.overview || "简介未缓存。"}</p>
            <div className="coverage">{coverage.map((field) => <Badge key={String(field)} variant="success"><Check aria-hidden="true"/>{field}</Badge>)}</div>
            {record?.posterPath && <p className="mt-3 break-all text-sm text-muted-foreground">海报路径：<code>{record.posterPath}</code></p>}
          </Panel>
          <Panel title="本地缓存字段" sub="仅预览已保存的数据，不代表外部 API 响应">
            {record ? <pre className="code-block json-preview"><code>{JSON.stringify({ tmdbId, locale: active, title: record.title, status: record.status }, null, 2)}</code></pre> : <p className="text-sm text-muted-foreground">当前语言没有可预览的缓存。</p>}
          </Panel>
        </div>
      </div>
    </div>
  </div>;
}
