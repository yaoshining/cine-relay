import { TmdbRequestError, type TmdbErrorCode, type TmdbMovieClient } from "./movie-client";
import type { MovieSelection } from "./movie-selection";

const sampleLimit = 5;

type SampleMovie = {
  tmdbId: number;
  title: string;
  titleProvided: boolean;
  overviewProvided: boolean;
};
type SampleFailure = { tmdbId: number; code: TmdbErrorCode; retryAt: string | null };

// A sandbox for discovery and fetched-field diagnostics. No database, cursor,
// credentials, raw response body or event service can be reached from here;
// the caller provides only the two upstream operations.
export async function runMovieSample(client: TmdbMovieClient, scope: MovieSelection) {
  const { ids, pageLimitReached } = await client.discover({ ...scope, limit: Math.min(scope.limit, sampleLimit) }, 2);
  const planned = [...new Set(ids)].slice(0, Math.min(scope.limit, sampleLimit));
  const movies: SampleMovie[] = [];
  const failures: SampleFailure[] = [];
  let stopped: "rate_limited" | "unauthorized" | "budget_unavailable" | null = null;

  for (const tmdbId of planned) {
    try {
      const { title, titleProvided, overviewProvided } = await client.detail(tmdbId, scope.locale);
      movies.push({ tmdbId, title, titleProvided, overviewProvided });
    } catch (error) {
      if (!(error instanceof TmdbRequestError)) throw error;
      failures.push({ tmdbId, code: error.code, retryAt: error.retryAt });
      if (error.code === "rate_limited" || error.code === "unauthorized" || error.code === "budget_unavailable") {
        stopped = error.code;
        break;
      }
    }
  }
  return { locale: scope.locale, selected: planned.length, movies, failures, unattempted: planned.length - movies.length - failures.length, stopped, pageLimitReached };
}
