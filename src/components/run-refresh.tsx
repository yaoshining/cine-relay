"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function RunRefresh() {
  const router = useRouter();
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 8_000);
    const stop = setTimeout(() => clearInterval(interval), 5 * 60_000);
    return () => { clearInterval(interval); clearTimeout(stop); };
  }, [router]);
  return null;
}
