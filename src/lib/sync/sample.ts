import { z } from "zod";
import { movieLocales } from "@/lib/db/schema";
import { runMovieSample } from "@/lib/tmdb/dry-run";
import { TmdbRequestError, type TmdbMovieClient } from "@/lib/tmdb/movie-client";
import { tmdbIdSchema, type MovieSelection } from "@/lib/tmdb/movie-selection";

const codes = z.enum(["unauthorized", "rate_limited", "not_found", "timeout", "upstream_error", "invalid_response", "budget_unavailable"]);
const retryAt = z.iso.datetime().nullable();

export const sampleSummarySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("sample"),
    locale: z.enum(movieLocales),
    selected: z.number().int().min(0).max(5),
    movies: z.array(z.object({
      tmdbId: tmdbIdSchema, title: z.string().min(1).max(500), titleProvided: z.boolean(), overviewProvided: z.boolean(),
    })).max(5),
    failures: z.array(z.object({ tmdbId: tmdbIdSchema, code: codes, retryAt })).max(5),
    unattempted: z.number().int().min(0).max(5),
    stopped: z.enum(["rate_limited", "unauthorized", "budget_unavailable"]).nullable(),
    pageLimitReached: z.boolean(),
  }),
  z.object({
    kind: z.literal("failure"),
    code: z.union([codes, z.enum(["invalid_config", "not_configured", "execution_failed"])]),
    retryAt,
  }),
]);
export type SampleSummary = z.infer<typeof sampleSummarySchema>;
export type SampleOutcome = { status: "completed" | "partial_failed" | "failed"; summary: SampleSummary };

export const sampleFailure = (code: Extract<SampleSummary, { kind: "failure" }>["code"], retryAt: string | null = null): SampleOutcome =>
  ({ status: "failed", summary: { kind: "failure", code, retryAt } });

export async function fetchSampleOutcome(client: TmdbMovieClient, selection: MovieSelection): Promise<SampleOutcome> {
  try {
    const report = await runMovieSample(client, selection);
    const status = report.failures.length ? report.movies.length ? "partial_failed" : "failed" : "completed";
    return { status, summary: { kind: "sample", ...report, movies: report.movies.map((movie) => ({ ...movie, title: movie.title.slice(0, 500).toWellFormed() })) } };
  } catch (error) {
    if (error instanceof TmdbRequestError) return sampleFailure(error.code, error.retryAt);
    throw error;
  }
}
