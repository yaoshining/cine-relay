import { and, asc, desc, eq, or, sql } from "drizzle-orm";
import { catalogPageSize, maxCatalogPage, parseTmdbId, type CacheState, type CatalogFilters } from "../movie-catalog";
import type { Database } from "./client";
import { movieLocalizations as loc, movies } from "./schema";

type MovieQueryDb = Pick<Database, "select">;

function cacheStatusAt(asOf: string) {
  return sql<CacheState>`case
    when ${movies.removedAt} is not null then 'removed'
    when ${loc.purgeAfter} <= ${asOf}::timestamptz then 'retained_until_passed'
    when ${loc.expiresAt} <= ${asOf}::timestamptz then 'stale'
    else 'fresh'
  end`;
}

export async function listMovieCatalog(db: MovieQueryDb, filters: CatalogFilters, asOf: string) {
  const status = cacheStatusAt(asOf);
  let search;
  if (filters.query) {
    if (/^#?[0-9]+$/.test(filters.query)) {
      const id = parseTmdbId(filters.query.replace(/^#/, ""));
      if (id === null) return { entries: [], hasNext: false };
      search = eq(loc.tmdbId, id);
    } else {
      const pattern = `%${filters.query.replace(/[!%_]/g, "!$&")}%`;
      search = or(sql`${loc.title} ilike ${pattern} escape '!'`,
        sql`${movies.originalTitle} ilike ${pattern} escape '!'`);
    }
  }

  const rows = await db.select({
    tmdbId: loc.tmdbId,
    locale: loc.locale,
    title: loc.title,
    releaseDate: movies.releaseDate,
    status,
  }).from(loc)
    .innerJoin(movies, eq(loc.tmdbId, movies.tmdbId))
    .where(and(search, filters.locale ? eq(loc.locale, filters.locale) : undefined,
      filters.state ? eq(status, filters.state) : undefined))
    .orderBy(
      filters.sort === "title" ? asc(sql`lower(${loc.title})`) : desc(loc.fetchedAt),
      asc(loc.tmdbId), asc(loc.locale),
    )
    .limit(catalogPageSize + 1)
    .offset((filters.page - 1) * catalogPageSize);

  return {
    entries: rows.slice(0, catalogPageSize).map((row) => ({ ...row, tmdbId: row.tmdbId.toString() })),
    hasNext: rows.length > catalogPageSize && filters.page < maxCatalogPage,
  };
}

export async function readMovieCatalogDetail(db: MovieQueryDb, id: bigint, asOf: string) {
  const rows = await db.select({
    movie: movies,
    localization: loc,
    status: cacheStatusAt(asOf),
  }).from(movies)
    .leftJoin(loc, eq(movies.tmdbId, loc.tmdbId))
    .where(eq(movies.tmdbId, id));
  if (!rows.length) return null;
  const movie = rows[0].movie;
  return {
    movie: { ...movie, tmdbId: movie.tmdbId.toString() },
    localizations: rows.flatMap(({ localization, status }) => {
      if (!localization) return [];
      const { tmdbId, ...fields } = localization;
      return [{ ...fields, tmdbId: tmdbId.toString(), status }];
    }),
  };
}

export type MovieCatalogPage = Awaited<ReturnType<typeof listMovieCatalog>>;
export type MovieCatalogDetail = NonNullable<Awaited<ReturnType<typeof readMovieCatalogDetail>>>;
