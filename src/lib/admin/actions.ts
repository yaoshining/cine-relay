"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { adminAuth, githubLoginConfigured } from "./auth";

export async function signInWithGitHub() {
  if (!githubLoginConfigured()) redirect("/login?error=Configuration");
  try {
    await adminAuth.signIn("github", { redirectTo: "/" });
  } catch (error) {
    if (error instanceof AuthError) redirect("/login?error=SignIn");
    throw error; // Includes Next.js's redirect to the provider.
  }
}

export async function signOutAdmin() {
  if (!githubLoginConfigured()) redirect("/login");
  await adminAuth.signOut({ redirectTo: "/login" });
}
