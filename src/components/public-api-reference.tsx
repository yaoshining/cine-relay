"use client";

import dynamic from "next/dynamic";

const Scalar = dynamic(() => import("@scalar/api-reference-react").then((mod) => mod.ApiReferenceReact), {
  ssr: false,
  loading: () => <p role="status" className="text-sm text-muted-foreground">正在载入交互式文档…</p>,
});

export function PublicApiReference() {
  return <Scalar configuration={{
    url: "/api/v1/openapi.json", darkMode: true, hideDarkModeToggle: true, withDefaultFonts: false,
    hideTestRequestButton: true, hideClientButton: true, telemetry: false,
  }}/>;
}
