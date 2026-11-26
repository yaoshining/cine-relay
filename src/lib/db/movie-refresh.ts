import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { movieLocalizations as loc, movies, type MovieLocale } from "./schema";
import type { FetchedMovie } from "./backfill";
import type { ReadDb, WriteDb } from "./sync-runs";

export async function lookupMovie(db: ReadDb, id: bigint, locale: MovieLocale) {
  return (await db.select({ movie: movies, localization: loc }).from(movies)
    .leftJoin(loc, and(eq(loc.tmdbId, movies.tmdbId), eq(loc.locale, locale)))
    .where(eq(movies.tmdbId, id)).limit(1))[0] ?? null;
}
export type MovieRecord = NonNullable<Awaited<ReturnType<typeof lookupMovie>>>;

export async function claimRefresh(db: WriteDb, id: bigint, locale: MovieLocale) {
  const token = randomUUID();
  const { rows } = await db.execute(sql`insert into public.movie_refresh_leases as lease (tmdb_id,locale,token,expires_at)
    values (${id.toString()}::bigint,${locale},${token}::uuid,now()+interval '20 seconds')
    on conflict (tmdb_id,locale) do update set token = excluded.token, expires_at = excluded.expires_at
    where lease.expires_at <= now() returning token`);
  return rows.length ? token : null;
}

export async function releaseRefresh(db: WriteDb, id: bigint, locale: MovieLocale, token: string) {
  await db.execute(sql`delete from public.movie_refresh_leases where tmdb_id = ${id.toString()}::bigint and locale = ${locale} and token = ${token}::uuid`);
}

export async function writeRefresh(db: WriteDb, token: string, movie: FetchedMovie) {
  const newer = sql`m.removed_at is null and excluded.updated_at > m.updated_at`;
  await db.execute(sql`
    with lease as (
      select tmdb_id, locale from public.movie_refresh_leases
      where tmdb_id = ${movie.tmdbId}::bigint and locale = ${movie.locale} and token = ${token}::uuid and expires_at > now()
      for update
    ), parent as (
      insert into public.movies as m (tmdb_id,original_title,release_date,genre_ids,updated_at,original_language,runtime_minutes)
      select tmdb_id,${movie.originalTitle},${movie.releaseDate}::date,
        array(select jsonb_array_elements_text(${JSON.stringify(movie.genreIds)}::jsonb)::integer),
        ${movie.fetchedAt}::timestamptz,${movie.originalLanguage},${movie.runtimeMinutes}::integer from lease
      on conflict (tmdb_id) do update set
        original_title = case when ${newer} then excluded.original_title else m.original_title end,
        release_date = case when ${newer} then excluded.release_date else m.release_date end,
        genre_ids = case when ${newer} then excluded.genre_ids else m.genre_ids end,
        updated_at = case when ${newer} then excluded.updated_at else m.updated_at end,
        original_language = case when ${newer} then excluded.original_language else m.original_language end,
        runtime_minutes = case when ${newer} then excluded.runtime_minutes else m.runtime_minutes end
      returning tmdb_id, removed_at
    ) insert into public.movie_localizations as l (tmdb_id,locale,title,overview,poster_path,fetched_at,expires_at,purge_after)
      select lease.tmdb_id,lease.locale,${movie.title},${movie.overview},${movie.posterPath},${movie.fetchedAt}::timestamptz,
        ${movie.fetchedAt}::timestamptz + interval '168 hours',${movie.fetchedAt}::timestamptz + interval '720 hours'
      from lease join parent using (tmdb_id) where parent.removed_at is null
      on conflict (tmdb_id,locale) do update set title=excluded.title,overview=excluded.overview,poster_path=excluded.poster_path,
        fetched_at=excluded.fetched_at,expires_at=excluded.expires_at,purge_after=excluded.purge_after
      where excluded.fetched_at > l.fetched_at`);
}
