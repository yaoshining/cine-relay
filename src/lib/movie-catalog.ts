import { movieLocales, type MovieLocale } from "./db/schema";

export const cacheStates = {
  fresh: "新鲜",
  stale: "已过期",
  retained_until_passed: "超出保留期",
  removed: "已下架",
} as const;
export type CacheState = keyof typeof cacheStates;
export const catalogPageSize = 20;
export const maxCatalogPage = 10_000;
const maxPostgresId = 9_223_372_036_854_775_807n;

export function parseTmdbId(input: string): bigint | null {
  if (!/^[1-9][0-9]{0,18}$/.test(input)) return null;
  const id = BigInt(input);
  return id <= maxPostgresId ? id : null;
}

export function isMovieLocale(input: unknown): input is MovieLocale {
  return movieLocales.some((locale) => locale === input);
}

export type MovieSearchParams = Record<string, string | string[] | undefined>;

export function parseCatalogParams(params: MovieSearchParams) {
  const read = (key: string) => typeof params[key] === "string" ? params[key] : undefined;
  const rawLocale = read("lang");
  const rawState = read("state");
  const rawPage = read("page");
  const page = rawPage && /^[1-9][0-9]{0,4}$/.test(rawPage) ? Number(rawPage) : 1;
  return {
    query: (read("q") ?? "").replaceAll("\0", "").trim().slice(0, 120).toWellFormed(),
    locale: isMovieLocale(rawLocale) ? rawLocale : null,
    state: rawState && Object.hasOwn(cacheStates, rawState) ? rawState as CacheState : null,
    sort: read("sort") === "title" ? "title" as const : "recent" as const,
    view: read("view") === "list" ? "list" as const : "grid" as const,
    page: page <= maxCatalogPage ? page : 1,
  };
}

export type CatalogFilters = ReturnType<typeof parseCatalogParams>;

export function catalogHref(filters: CatalogFilters, override: Partial<CatalogFilters> = {}) {
  const { query, locale, state, sort, view, page } = { ...filters, ...override };
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (locale) params.set("lang", locale);
  if (state) params.set("state", state);
  if (sort !== "recent") params.set("sort", sort);
  if (view !== "grid") params.set("view", view);
  if (page > 1) params.set("page", String(page));
  return params.size ? `/movies?${params}` : "/movies";
}

export function movieCacheHref(id: string, locale: MovieLocale) {
  return `/movies/${id}?lang=${locale}`;
}
