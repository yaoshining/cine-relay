import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/guard";
import { getDb } from "@/lib/db/client";
import { readMovieCatalogDetail } from "@/lib/db/movie-catalog";
import { isMovieLocale, parseTmdbId, type MovieSearchParams } from "@/lib/movie-catalog";
import { MovieCacheDetail } from "./view";
import { Callout, PageHead } from "@/components/console";

async function readDetail(tmdbId: bigint) {
  try {
    return { detail: await readMovieCatalogDetail(getDb(), tmdbId, new Date().toISOString()) };
  } catch {
    return null;
  }
}

export default async function Page({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<MovieSearchParams>;
}) {
  await requireAdmin();
  const [{ id }, { lang }] = await Promise.all([params, searchParams]);
  const tmdbId = parseTmdbId(id);
  if (tmdbId === null || (lang !== undefined && !isMovieLocale(lang))) notFound();
  const result = await readDetail(tmdbId);
  if (!result) return <div className="page-flow"><PageHead title="电影详情"/><Callout warning>暂时无法读取电影缓存。请检查数据库连接和迁移状态后重试。</Callout></div>;
  if (!result.detail) notFound();
  return <MovieCacheDetail detail={result.detail} locale={lang}/>;
}
