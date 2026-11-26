import { and, eq } from "drizzle-orm"
import type { Database } from "./client"
import { movieLocalizations, movies, type MovieLocale } from "./schema"

// Raw cache data only. Callers decide whether stale, past-retention, or
// removed rows are eligible for their view; this never triggers TMDB.
export async function findMovieCache(db: Pick<Database, "select">, tmdbId: bigint, locale: MovieLocale) {
  const [entry] = await db.select({ movie: movies, localization: movieLocalizations })
    .from(movieLocalizations)
    .innerJoin(movies, eq(movieLocalizations.tmdbId, movies.tmdbId))
    .where(and(eq(movieLocalizations.tmdbId, tmdbId), eq(movieLocalizations.locale, locale)))
    .limit(1)

  return entry ?? null
}
