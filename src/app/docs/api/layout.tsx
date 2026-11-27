import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import "@scalar/api-reference-react/style.css";

export default function PublicDocsLayout({ children }: { children: ReactNode }) {
  return <main id="content" className="min-h-dvh">
    <Link href="/" prefetch={false} className="fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[max(1rem,env(safe-area-inset-bottom))] z-20 inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground shadow-lg hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
      <ArrowLeft className="size-4" aria-hidden="true" /> 返回 CineRelay
    </Link>
    {children}
  </main>;
}
