import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "CineRelay · 运营控制台", template: "%s · CineRelay" },
  description: "CineRelay 管理界面，使用合成数据的 1.1 视觉骨架。",
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="zh-CN" className="dark"><body><AppShell>{children}</AppShell></body></html>;
}
