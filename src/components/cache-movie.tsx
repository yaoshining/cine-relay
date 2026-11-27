import { Check, CircleAlert, Film } from "lucide-react";
import { cacheStates, type CacheState } from "@/lib/movie-catalog";

export function CacheMovieStatus({ status }: { status: CacheState }) {
  const Icon = status === "fresh" ? Check : CircleAlert;
  const tone = status === "fresh" ? "fresh" : status === "removed" ? "text-destructive" : "expired";
  return <span className={`movie-status ${tone}`}><Icon aria-hidden="true"/>{cacheStates[status]}</span>;
}

export function CacheMoviePoster({ full = false }: { full?: boolean }) {
  return <div className={`poster poster-placeholder place-content-center gap-2 bg-muted text-center text-muted-foreground ${full ? "rounded-lg border border-border" : ""}`}>
    <Film className="mx-auto size-7" aria-hidden="true"/>
    <span className="text-xs">海报未加载</span>
  </div>;
}
