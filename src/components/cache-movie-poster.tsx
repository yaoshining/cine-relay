"use client";

import Image from "next/image";
import { Film } from "lucide-react";
import { useState } from "react";

export function CacheMoviePoster({ path, full = false }: { path: string | null | undefined; full?: boolean }) {
  const src = path && /^\/[a-zA-Z0-9_-]+\.(?:jpg|jpeg|png|webp)$/i.test(path)
    ? `https://image.tmdb.org/t/p/${full ? "w500" : "w342"}${path}` : null;
  const [failed, setFailed] = useState<string | null>(null);
  const frame = `poster overflow-hidden ${full ? "rounded-lg border border-border" : ""}`;
  if (src && failed !== src) return <Image unoptimized src={src} width={full ? 500 : 342} height={full ? 750 : 513}
    alt="" className={`${frame} object-cover`} referrerPolicy="no-referrer" onError={() => setFailed(src)}/>;
  return <div className={`${frame} poster-placeholder place-content-center gap-2 bg-muted text-center text-muted-foreground`}>
    <Film className="mx-auto size-7" aria-hidden="true"/>
    <span className="text-xs">{src ? "海报加载失败" : "暂无海报"}</span>
  </div>;
}
