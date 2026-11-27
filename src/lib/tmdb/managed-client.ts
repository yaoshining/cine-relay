import "server-only";
import { getDb } from "@/lib/db/client";
import { withTmdbPermit } from "@/lib/db/tmdb-gate";
import { nextTmdbCredential, noteTmdbCredential } from "@/lib/db/tmdb-credentials";
import { openCredential, parsePoolKey } from "./credential-crypto";
import { createTmdbMovieClient, createTmdbTransport, type TmdbRequestGuard, TmdbRequestError } from "./movie-client";

export function tmdbConfigured() {
  return process.env.TMDB_KEY_ENCRYPTION_KEY !== undefined
    ? !!parsePoolKey(process.env.TMDB_KEY_ENCRYPTION_KEY)
    : !!process.env.TMDB_READ_TOKEN?.trim();
}

const sharedTmdbGuard = (background = false): TmdbRequestGuard => async (work) => {
    try {
      const db = getDb();
      return await withTmdbPermit(db, async () => {
        const poolSecret = process.env.TMDB_KEY_ENCRYPTION_KEY;
        if (poolSecret === undefined) {
          const legacy = process.env.TMDB_READ_TOKEN?.trim();
          if (!legacy) throw new TmdbRequestError("unauthorized");
          return work(legacy);
        }
        const key = parsePoolKey(poolSecret);
        const credential = key ? await nextTmdbCredential(db) : null;
        if (!key || !credential) throw new TmdbRequestError("unauthorized");
        let token;
        try {
          token = openCredential(key, credential.id, credential.encrypted_token);
        } catch {
          await noteTmdbCredential(db, credential.id, "credential_unreadable").catch(() => {});
          throw new TmdbRequestError("unauthorized");
        }
        try {
          const result = await work(token);
          await noteTmdbCredential(db, credential.id, null).catch(() => {});
          return result;
        } catch (error) {
          if (error instanceof TmdbRequestError && error.code !== "budget_unavailable") {
            await noteTmdbCredential(db, credential.id, error.code).catch(() => {});
          }
          throw error;
        }
      }, background);
    } catch (error) {
      if (error instanceof TmdbRequestError) throw error;
      throw new TmdbRequestError("budget_unavailable");
    }
};

export function managedTmdbClient() {
  return createTmdbMovieClient("", fetch, Date.now, sharedTmdbGuard());
}

export function managedTvTransport(background = false) {
  return createTmdbTransport("", fetch, Date.now, sharedTmdbGuard(background));
}
