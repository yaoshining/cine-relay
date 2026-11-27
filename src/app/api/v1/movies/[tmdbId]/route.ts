import { consumerError, movieDetail } from "@/lib/consumer/movie-detail";
import { authorizeConsumer } from "@/lib/db/consumer-keys";
import { getDb } from "@/lib/db/client";
import { isMovieLocale, parseTmdbId } from "@/lib/movie-catalog";
import { managedTmdbClient, tmdbConfigured } from "@/lib/tmdb/managed-client";

export async function GET(request: Request, { params }: { params: Promise<{ tmdbId: string }> }) {
  const authorization = request.headers.get("authorization");
  if (!authorization) return consumerError("unauthorized");
  try {
    const db = getDb();
    if (!await authorizeConsumer(db, authorization)) return consumerError("unauthorized");
    const query = new URL(request.url).searchParams.getAll("lang");
    const locale = query[0] ?? "zh-CN";
    const id = parseTmdbId((await params).tmdbId);
    if (id === null || query.length > 1 || !isMovieLocale(locale)) return consumerError("invalid_request");
    return await movieDetail(db, id, locale, () => tmdbConfigured() ? managedTmdbClient() : null);
  } catch {
    return consumerError("unavailable");
  }
}
