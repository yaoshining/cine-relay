import { redirect } from "next/navigation";
import { signInWithGitHub } from "@/lib/admin/actions";
import { githubLoginConfigured } from "@/lib/admin/auth";
import { getAdmin } from "@/lib/admin/guard";
import { LoginView } from "./view";

export const dynamic = "force-dynamic";

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string | string[] }> }) {
  const { error } = await searchParams;
  if (!error && await getAdmin()) redirect("/");
  return <LoginView enabled={githubLoginConfigured()} error={typeof error === "string" ? error : undefined} signIn={signInWithGitHub}/>;
}
