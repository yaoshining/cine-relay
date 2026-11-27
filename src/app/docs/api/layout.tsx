import Link from "next/link";
import type { ReactNode } from "react";
import "@scalar/api-reference-react/style.css";
import { BrandMark } from "@/components/brand";

export default function PublicDocsLayout({ children }: { children: ReactNode }) {
  return <main id="content" className="mx-auto max-w-screen-2xl p-4 sm:p-6">
    <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <Link href="/docs/api" className="wordmark"><BrandMark/>CineRelay</Link>
      <Link href="/login" className="text-link">管理员登录</Link>
    </header>
    {children}
  </main>;
}
