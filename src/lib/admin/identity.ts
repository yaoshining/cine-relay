import type { Account, NextAuthConfig, Session } from "next-auth";
import type { JWT } from "next-auth/jwt";

export const adminSessionSeconds = 8 * 60 * 60;

export function isGitHubId(value: unknown): value is string {
  return typeof value === "string" && /^[1-9][0-9]*$/.test(value);
}

export function isInvitedGitHubId(id: unknown, configuredIds: string | undefined): id is string {
  if (!isGitHubId(id) || !configuredIds) return false;
  const ids = configuredIds.split(",").map((part) => part.trim());
  return ids.every(isGitHubId) && ids.includes(id);
}

export type OAuthAdmission = Readonly<{ githubId: string; allowed: boolean }>;

export function adminCallbacks(
  writeAdmission: (event: OAuthAdmission) => Promise<void>,
  configuredIds: () => string | undefined,
  now: () => number = Date.now,
) {
  const invited = (id: unknown): id is string => isInvitedGitHubId(id, configuredIds());

  return {
    async signIn({ account }: { account?: Account | null }) {
      const id = account?.providerAccountId;
      if (account?.provider !== "github" || !isGitHubId(id)) return false;
      const allowed = invited(id);
      // An admission cannot be granted without its audit record.
      await writeAdmission({ githubId: id, allowed });
      return allowed;
    },
    jwt({ token, account }: { token: JWT; account?: Account | null }) {
      const nowSeconds = Math.floor(now() / 1000);
      if (account) {
        const id = account.providerAccountId;
        if (account.provider !== "github" || !invited(id)) return null;
        // Do not retain the OAuth profile, provider tokens or Auth.js's default user claims.
        return { githubId: id, adminIssuedAt: nowSeconds };
      }
      const { githubId, adminIssuedAt } = token;
      if (!invited(githubId) || typeof adminIssuedAt !== "number" ||
          !Number.isSafeInteger(adminIssuedAt) || adminIssuedAt > nowSeconds ||
          nowSeconds - adminIssuedAt >= adminSessionSeconds) return null;
      return token;
    },
    session({ session, token }: { session: Session; token: JWT }) {
      const { githubId, adminIssuedAt } = token;
      if (!isGitHubId(githubId) || typeof adminIssuedAt !== "number") return { expires: session.expires };
      return {
        expires: new Date((adminIssuedAt + adminSessionSeconds) * 1000).toISOString(),
        user: { githubId },
      };
    },
    redirect({ url, baseUrl }) {
      try {
        const target = new URL(url, baseUrl);
        if (target.origin === new URL(baseUrl).origin && target.pathname === "/login") {
          return new URL("/login", baseUrl).href;
        }
      } catch { /* Never redirect to a caller-supplied origin. */ }
      return new URL("/", baseUrl).href;
    },
  } satisfies NonNullable<NextAuthConfig["callbacks"]>;
}

declare module "next-auth" {
  interface Session {
    user?: { githubId: string };
  }
}
