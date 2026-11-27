import assert from "node:assert/strict";
import test from "node:test";
import { createTmdbMovieClient, TmdbRequestError } from "../src/lib/tmdb/movie-client";
import { movieSelectionSchema } from "../src/lib/tmdb/movie-selection";
import { runMovieSample } from "../src/lib/tmdb/dry-run";

const now = Date.parse("2026-02-01T12:30:00Z");
const scope = movieSelectionSchema.parse({
  releaseFrom: "2024-02-29", releaseThrough: "2025-04-30", originalLanguage: "ja",
  genreIds: [18, 878, 18], locale: "zh-CN", limit: 250,
});
const discovery = (ids: number[], pages = 1) => Response.json({ total_pages: pages, results: ids.map((id) => ({ id })) });
const detail = (id: number, overrides: Record<string, unknown> = {}) => Response.json({
  id, title: "合成标题", original_title: "Synthetic original", overview: " 译文内容 ", poster_path: "/asset.jpg",
  release_date: "2024-03-20", original_language: "ja", genres: [{ id: 18 }], runtime: 120, ...overrides,
});

test("validates bounded Discover scope and dates", () => {
  assert.deepEqual(scope.genreIds, [18, 878]);
  for (const invalid of [
    { releaseFrom: "2023-02-29" }, { releaseThrough: "2024-02-28" }, { releaseFrom: "0000-01-01" },
    { originalLanguage: "zh-CN" }, { locale: "ja-JP" }, { genreIds: [0] }, { limit: 501 }, { unknown: true },
  ]) {
    assert.equal(movieSelectionSchema.safeParse({ ...scope, ...invalid }).success, false);
  }
});

test("samples at most five distinct movies with the configured Discover filters and locale", async () => {
  const seen: string[] = [];
  const client = createTmdbMovieClient("synthetic-token", async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.origin, "https://api.themoviedb.org");
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer synthetic-token");
    assert.equal(init?.redirect, "error");
    assert.equal(init?.cache, "no-store");
    assert.equal(url.searchParams.get("language"), "zh-CN");
    seen.push(url.pathname);
    if (url.pathname === "/3/discover/movie") {
      assert.equal(url.searchParams.get("primary_release_date.gte"), "2024-02-29");
      assert.equal(url.searchParams.get("primary_release_date.lte"), "2025-04-30");
      assert.equal(url.searchParams.get("with_original_language"), "ja");
      assert.equal(url.searchParams.get("with_genres"), "18|878");
      assert.equal(url.searchParams.get("include_adult"), "false");
      assert.equal(url.searchParams.get("sort_by"), "popularity.desc");
      return url.searchParams.get("page") === "1" ? discovery([1, 2], 3) : discovery([2, 3, 4, 5, 6, 7], 3);
    }
    const id = Number(url.pathname.split("/").at(-1));
    if (id === 2) return new Response("private upstream detail", { status: 404 });
    if (id === 3) return detail(99);
    if (id === 4) return detail(id, { title: "", overview: " " });
    return detail(id);
  }, () => now);
  const result = await runMovieSample(client, scope);
  assert.deepEqual(seen, ["/3/discover/movie", "/3/discover/movie", ...[1, 2, 3, 4, 5].map((id) => `/3/movie/${id}`)]);
  assert.equal(result.selected, 5);
  assert.equal(result.unattempted, 0);
  assert.deepEqual(result.failures.map((failure) => [failure.tmdbId, failure.code]), [[2, "not_found"], [3, "invalid_response"]]);
  assert.deepEqual(result.movies[1], { tmdbId: 4, title: "Synthetic original", titleProvided: false, overviewProvided: false });
  assert.doesNotMatch(JSON.stringify(result), /synthetic-token|private upstream|asset\.jpg/);
});

test("429 stops additional requests and yields a normalized Retry-After time", async () => {
  for (const [retryAfter, expected] of [
    ["15", "2026-02-01T12:30:15.000Z"], ["Sun, 01 Feb 2026 12:40:00 GMT", "2026-02-01T12:40:00.000Z"],
    ["1.5", "2026-02-01T12:31:00.000Z"],
  ]) {
    const paths: string[] = [];
    const client = createTmdbMovieClient("synthetic", async (input) => {
      const path = new URL(String(input)).pathname;
      paths.push(path);
      if (path === "/3/discover/movie") return discovery([21, 22, 23]);
      if (path === "/3/movie/21") return detail(21);
      return new Response(null, { status: 429, headers: { "Retry-After": retryAfter } });
    }, () => now);
    const result = await runMovieSample(client, scope);
    assert.deepEqual(paths, ["/3/discover/movie", "/3/movie/21", "/3/movie/22"]);
    assert.equal(result.stopped, "rate_limited");
    assert.equal(result.unattempted, 1);
    assert.deepEqual(result.failures, [{ tmdbId: 22, code: "rate_limited", retryAt: expected }]);
  }
});

test("auth denial halts the sample; discovery failures do not leak the raw upstream message", async () => {
  let called = 0;
  const client = createTmdbMovieClient("synthetic", async () => ++called === 1 ? discovery([10, 11, 12]) : new Response(null, { status: 403 }));
  const result = await runMovieSample(client, { ...scope, limit: 2 });
  assert.equal(result.selected, 2);
  assert.equal(result.stopped, "unauthorized");
  assert.equal(called, 2);

  const unreachable = createTmdbMovieClient("synthetic", async () => { throw new Error("sensitive URL or token"); });
  await assert.rejects(runMovieSample(unreachable, scope), (error) =>
    error instanceof TmdbRequestError && error.message === "upstream_error" && !error.cause,
  );
});

test("detail normalization keeps only known fields and original observation time", async () => {
  const client = createTmdbMovieClient("synthetic", async () => detail(18, {
    poster_path: "https://elsewhere.invalid/image.png", runtime: 0, release_date: "",
    genres: [{ id: 18 }, { id: 18 }, { id: 878 }], debug: "discard",
  }), () => now);
  const result = await client.detail(18, "en-US");
  assert.deepEqual(result, {
    tmdbId: 18, locale: "en-US", title: "合成标题", originalTitle: "Synthetic original", originalLanguage: "ja",
    runtimeMinutes: null, releaseDate: null, genreIds: [18, 878], overview: "译文内容", posterPath: null,
    fetchedAt: "2026-02-01T12:30:00.000Z", titleProvided: true, overviewProvided: true,
  });
});
