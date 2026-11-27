import { z } from "zod";
import { movieSelectionSchema } from "@/lib/tmdb/movie-selection";

export const templateIdSchema = z.uuid();
export const syncConfigSchema = z.strictObject({
  version: z.literal(1),
  name: z.string().trim().min(1).max(120).refine((s) => !s.includes("\0")),
  mode: z.enum(["backfill", "incremental"]),
  selection: movieSelectionSchema,
  fieldGroup: z.literal("movie_details"),
  schedule: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("manual") }),
    z.strictObject({ kind: z.literal("daily"), hour: z.number().int().min(0).max(23), timezone: z.literal("Asia/Shanghai") }),
    z.strictObject({ kind: z.literal("weekly"), hour: z.number().int().min(0).max(23), weekday: z.number().int().min(1).max(7), timezone: z.literal("Asia/Shanghai") }),
  ]),
});

export type SyncConfig = z.infer<typeof syncConfigSchema>;

const int = (value: FormDataEntryValue | null) => typeof value === "string" && /^[0-9]+$/.test(value) ? Number(value) : NaN;

export function parseSyncForm(form: FormData) {
  const kind = form.get("schedule");
  const language = form.get("originalLanguage");
  return syncConfigSchema.safeParse({
    version: 1,
    name: form.get("name"),
    mode: form.get("mode"),
    selection: {
      releaseFrom: form.get("releaseFrom"),
      releaseThrough: form.get("releaseThrough"),
      genreIds: form.getAll("genreId").filter((genre) => genre !== "").map(int),
      originalLanguage: language === "" ? null : language,
      locale: form.get("locale"),
      limit: int(form.get("limit")),
    },
    fieldGroup: form.get("fieldGroup"),
    schedule: kind === "manual" ? { kind } : {
      kind, hour: int(form.get("hour")), timezone: "Asia/Shanghai",
      ...(kind === "weekly" && { weekday: int(form.get("weekday")) }),
    },
  });
}
