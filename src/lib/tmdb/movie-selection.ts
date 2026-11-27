import { z } from "zod";
import { movieLocales } from "../db/schema";

export const tmdbIdSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
export const tmdbGenreSchema = z.number().int().positive().max(2_147_483_647);
export const tmdbReleaseDateSchema = z.iso.date().refine((value) => !value.startsWith("0000-"));
export const tmdbOriginalLanguageSchema = z.string().regex(/^[a-z]{2}$/);

export const movieSelectionSchema = z.strictObject({
  releaseFrom: tmdbReleaseDateSchema,
  releaseThrough: tmdbReleaseDateSchema,
  genreIds: z.array(tmdbGenreSchema).max(10).transform((ids) => [...new Set(ids)]),
  originalLanguage: tmdbOriginalLanguageSchema.nullable(),
  locale: z.enum(movieLocales),
  limit: z.number().int().min(1).max(500),
}).refine((scope) => scope.releaseFrom <= scope.releaseThrough, {
  path: ["releaseThrough"], message: "截止日期不可早于开始日期",
});

export type MovieSelection = z.infer<typeof movieSelectionSchema>;
