import "server-only";

import NextAuth, { AuthError } from "next-auth";
import GitHub from "next-auth/providers/github";
import { getDb } from "@/lib/db/client";
import { writeOAuthAdmission } from "@/lib/db/admin-audit";
import { readAuthConfig } from "./config";
import { adminCallbacks, adminSessionSeconds } from "./identity";

export function githubLoginConfigured() {
  return readAuthConfig(process.env) !== null;
}

export const adminAuth = NextAuth(() => {
  const config = readAuthConfig(process.env);
  if (!config) throw new Error("GitHub admin authentication is not configured");
  return {
    // The public origin comes from the validated AUTH_URL, not an incoming Host header.
    trustHost: true,
    secret: config.secret,
    providers: [GitHub({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      checks: ["pkce", "state"],
      authorization: { params: { scope: "read:user" } },
      userinfo: {
        async request({ tokens }: { tokens: { access_token?: string } }) {
          if (!tokens.access_token) throw new Error("Missing GitHub access token");
          const response = await fetch("https://api.github.com/user", {
            headers: { Authorization: `Bearer ${tokens.access_token}`, "User-Agent": "CineRelay" },
            cache: "no-store",
            redirect: "error",
            signal: AbortSignal.timeout(10_000),
          });
          if (!response.ok) throw new Error("Could not verify GitHub account");
          const { id } = await response.json();
          if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Invalid GitHub account ID");
          return { id };
        },
      },
    })],
    pages: { signIn: "/login", error: "/login" },
    session: { strategy: "jwt", maxAge: adminSessionSeconds },
    callbacks: adminCallbacks(async (event) => {
      try {
        await writeOAuthAdmission(getDb(), event);
      } catch {
        console.error("[admin-auth] Could not persist OAuth admission");
        throw new Error("Could not persist OAuth admission");
      }
    }, () => process.env.ADMIN_GITHUB_IDS),
    // Auth.js error causes/debug payloads may include upstream or database details.
    logger: {
      error(error) { console.error("[admin-auth]", error instanceof AuthError ? error.type : "UnexpectedError"); },
      warn(code) { console.warn("[admin-auth]", code); },
      debug() {},
    },
  };
});
