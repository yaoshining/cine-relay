import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { adminAuth, githubLoginConfigured } from "./auth";
import { isInvitedGitHubId } from "./identity";

export const getAdmin = cache(async () => {
  if (!githubLoginConfigured()) return null;
  const session = await adminAuth.auth();
  const githubId = session?.user?.githubId;
  return isInvitedGitHubId(githubId, process.env.ADMIN_GITHUB_IDS) ? { githubId } : null;
});

export async function requireAdmin() {
  const admin = await getAdmin();
  if (!admin) redirect("/login");
  return admin;
}
