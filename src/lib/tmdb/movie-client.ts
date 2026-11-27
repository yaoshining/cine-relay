import { z } from "zod";
import type { MovieLocale } from "../db/schema";
import {
  tmdbGenreSchema, tmdbIdSchema, tmdbOriginalLanguageSchema, tmdbReleaseDateSchema, type MovieSelection,
} from "./movie-selection";

const endpoint = "https://api.themoviedb.org/3";
const maxDiscoveryPages = 30;
const timeoutMs = 7_000;
const defaultCoolDownMs = 60_000;

export type TmdbErrorCode = "unauthorized" | "rate_limited" | "not_found" | "timeout" | "upstream_error" | "invalid_response" | "budget_unavailable";

export class TmdbRequestError extends Error {
  constructor(readonly code: TmdbErrorCode, readonly retryAt: string | null = null) {
    super(code);
    this.name = "TmdbRequestError";
  }
}

const discoverySchema = z.object({
  total_pages: z.number().int().nonnegative(),
  results: z.array(z.object({ id: tmdbIdSchema })).max(500),
});
const changesSchema = z.object({
  total_pages: z.number().int().nonnegative(),
  results: z.array(z.object({ id: tmdbIdSchema, adult: z.boolean().nullish() })).max(100),
});
const text = z.string().trim().refine((value) => !value.includes("\0")).nullish()
  .transform((value) => value || null);
const detailSchema = z.object({
  id: tmdbIdSchema,
  title: text,
  original_title: text,
  overview: text,
  poster_path: text,
  release_date: tmdbReleaseDateSchema.or(z.literal("")).nullish(),
  original_language: tmdbOriginalLanguageSchema.or(z.literal("")).nullish(),
  genres: z.array(z.object({ id: tmdbGenreSchema })).max(100),
  runtime: z.number().int().min(0).max(2_147_483_647).nullish(),
});

function retryTime(header: string | null, asOf: number) {
  const trimmed = header?.trim();
  const target = !trimmed ? NaN
    : /^[0-9]+$/.test(trimmed) ? asOf + Number(trimmed) * 1000
    : /^[A-Z][a-z]{2},/.test(trimmed) ? Date.parse(trimmed) : NaN;
  const date = new Date(Math.max(asOf, target));
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date(asOf + defaultCoolDownMs).toISOString();
}

// Caller supplies the credential server-side. This client makes one attempt per
// request. It never retries or rotates a credential in response to a 429.
export type TmdbRequestGuard = (work: (overrideToken?: string) => Promise<unknown>) => Promise<unknown>;

export function createTmdbMovieClient(token: string, request: typeof fetch = fetch, now: () => number = Date.now,
  guard: TmdbRequestGuard = (work) => work()) {
  const requestJson = (path: string, params: URLSearchParams) => guard((overrideToken) => fetchJson(path, params, overrideToken ?? token));

  async function fetchJson(path: string, params: URLSearchParams, credential: string): Promise<unknown> {
    const signal = AbortSignal.timeout(timeoutMs);
    try {
      const response = await request(`${endpoint}${path}?${params}`, {
        headers: { Authorization: `Bearer ${credential}`, Accept: "application/json" },
        cache: "no-store",
        redirect: "error",
        signal,
      });
      if (!response.ok) {
        void response.body?.cancel().catch(() => {});
        if (response.status === 429) throw new TmdbRequestError("rate_limited", retryTime(response.headers.get("Retry-After"), now()));
        if (response.status === 401 || response.status === 403) throw new TmdbRequestError("unauthorized");
        if (response.status === 404) throw new TmdbRequestError("not_found");
        throw new TmdbRequestError("upstream_error");
      }
      try {
        return await response.json();
      } catch {
        throw new TmdbRequestError(signal.aborted ? "timeout" : "invalid_response");
      }
    } catch (error) {
      if (error instanceof TmdbRequestError) throw error;
      // Do not pass along headers, the response body or transport errors.
      throw new TmdbRequestError(signal.aborted ? "timeout" : "upstream_error");
    }
  }

  return {
    async discover(scope: MovieSelection, pageBudget = maxDiscoveryPages) {
      const ids = new Set<number>();
      for (let page = 1; page <= Math.min(pageBudget, maxDiscoveryPages); page++) {
        const params = new URLSearchParams({
          "primary_release_date.gte": scope.releaseFrom,
          "primary_release_date.lte": scope.releaseThrough,
          language: scope.locale,
          include_adult: "false",
          sort_by: "popularity.desc",
          page: String(page),
        });
        if (scope.genreIds.length) params.set("with_genres", scope.genreIds.join("|"));
        if (scope.originalLanguage) params.set("with_original_language", scope.originalLanguage);
        const result = discoverySchema.safeParse(await requestJson("/discover/movie", params));
        if (!result.success) throw new TmdbRequestError("invalid_response");
        for (const { id } of result.data.results) {
          ids.add(id);
          if (ids.size >= scope.limit) return { ids: [...ids], pageLimitReached: false };
        }
        if (page >= result.data.total_pages) return { ids: [...ids], pageLimitReached: false };
      }
      return { ids: [...ids], pageLimitReached: true };
    },

    async changesPage(from: string, to: string, page: number) {
      const result = changesSchema.safeParse(await requestJson("/movie/changes", new URLSearchParams({
        start_date: from, end_date: to, page: String(page),
      })));
      if (!result.success) throw new TmdbRequestError("invalid_response");
      return { ids: result.data.results.filter(({ adult }) => adult !== true).map(({ id }) => id), pages: result.data.total_pages };
    },

    async detail(id: number, locale: MovieLocale) {
      if (!tmdbIdSchema.safeParse(id).success) throw new TmdbRequestError("invalid_response");
      const result = detailSchema.safeParse(await requestJson(`/movie/${id}`, new URLSearchParams({ language: locale })));
      if (!result.success || result.data.id !== id) throw new TmdbRequestError("invalid_response");
      const detail = result.data;
      const title = detail.title ?? detail.original_title;
      if (!title) throw new TmdbRequestError("invalid_response");
      return {
        tmdbId: id,
        locale,
        title,
        originalTitle: detail.original_title,
        originalLanguage: detail.original_language || null,
        runtimeMinutes: detail.runtime || null,
        releaseDate: detail.release_date || null,
        genreIds: [...new Set(detail.genres.map((genre) => genre.id))],
        overview: detail.overview,
        posterPath: detail.poster_path && /^\/[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/.test(detail.poster_path) ? detail.poster_path : null,
        fetchedAt: new Date(now()).toISOString(),
        titleProvided: detail.title !== null,
        overviewProvided: detail.overview !== null,
      };
    },
  };
}

export type TmdbMovieClient = ReturnType<typeof createTmdbMovieClient>;
