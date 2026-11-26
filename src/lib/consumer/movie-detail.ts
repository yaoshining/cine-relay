import { claimRefresh, lookupMovie, releaseRefresh, writeRefresh, type MovieRecord } from "@/lib/db/movie-refresh";
import type { MovieLocale } from "@/lib/db/schema";
import type { ReadDb, WriteDb } from "@/lib/db/sync-runs";
import { TmdbRequestError, type TmdbMovieClient } from "@/lib/tmdb/movie-client";

const headers = { "Cache-Control": "private, no-store" };
export function consumerError(code: keyof typeof status, retryAfter?: number) {
  const responseHeaders = new Headers(headers);
  if (code === "unauthorized") responseHeaders.set("WWW-Authenticate", "Bearer");
  if (code === "unavailable") responseHeaders.set("Retry-After", String(retryAfter ?? 5));
  return Response.json({ error: code }, { status: status[code], headers: responseHeaders });
}
const status = { invalid_request: 400, unauthorized: 401, not_found: 404, unavailable: 503 } as const;

function iso(value: string) { return new Date(value).toISOString(); }

function fromCache(entry: MovieRecord, cache: "hit" | "refreshed" | "stale") {
  const { movie, localization: l } = entry;
  if (!l) return consumerError("unavailable");
  return Response.json({
    tmdbId: movie.tmdbId.toString(), locale: l.locale, title: l.title, originalTitle: movie.originalTitle,
    overview: l.overview, posterPath: l.posterPath, releaseDate: movie.releaseDate, genreIds: movie.genreIds,
    originalLanguage: movie.originalLanguage, runtimeMinutes: movie.runtimeMinutes,
    fetchedAt: iso(l.fetchedAt), expiresAt: iso(l.expiresAt), cache, stale: cache === "stale",
  }, { headers });
}

export async function movieDetail(db: ReadDb & WriteDb, id: bigint, locale: MovieLocale,
  client: () => Pick<TmdbMovieClient, "detail"> | null, now = Date.now) {
  let current = await lookupMovie(db, id, locale);
  const fresh = (entry: MovieRecord | null) => entry?.localization && Date.parse(entry.localization.expiresAt) > now();
  const fallback = (retryAfter?: number) => {
    if (current?.movie.removedAt) return consumerError("not_found");
    if (current && fresh(current)) return fromCache(current, "hit");
    if (current?.localization && Date.parse(current.localization.purgeAfter) > now()) return fromCache(current, "stale");
    return consumerError("unavailable", retryAfter);
  };

  if (current?.movie.removedAt) return consumerError("not_found");
  if (current && fresh(current)) return fromCache(current, "hit");
  if (id > BigInt(Number.MAX_SAFE_INTEGER)) return current?.localization ? fallback() : consumerError("not_found");
  const upstream = client();
  if (!upstream) return fallback();
  const lease = await claimRefresh(db, id, locale);
  if (!lease) {
    current = await lookupMovie(db, id, locale);
    return fallback(2);
  }
  try {
    current = await lookupMovie(db, id, locale);
    if (current?.movie.removedAt) return consumerError("not_found");
    if (current && fresh(current)) return fromCache(current, "hit");
    try {
      const fetched = await upstream.detail(Number(id), locale);
      await writeRefresh(db, lease, fetched);
    } catch (error) {
      if (!(error instanceof TmdbRequestError)) throw error;
      if (error.code === "not_found") return consumerError("not_found");
      const seconds = error.retryAt ? Math.max(1, Math.ceil((Date.parse(error.retryAt) - now())/1000)) : undefined;
      current = await lookupMovie(db, id, locale);
      return fallback(seconds);
    }
    current = await lookupMovie(db, id, locale);
    if (current?.movie.removedAt) return consumerError("not_found");
    return current && fresh(current) ? fromCache(current, "refreshed") : fallback();
  } finally {
    await releaseRefresh(db, id, locale, lease).catch(() => {});
  }
}
