import type { ReactNode } from "react";
import "@scalar/api-reference-react/style.css";

export default function DocsLayout({ children }: { children: ReactNode }) {
  return <main id="content" className="min-h-dvh">{children}</main>;
}
