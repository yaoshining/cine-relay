import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "CineRelay · 运营控制台", template: "%s · CineRelay" },
  description: "CineRelay 影视元数据管理控制台。",
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="zh-CN" className="dark"><body>{children}</body></html>;
}
