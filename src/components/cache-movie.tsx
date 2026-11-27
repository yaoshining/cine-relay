import { Check, CircleAlert } from "lucide-react";
import { cacheStates, type CacheState } from "@/lib/movie-catalog";

export function CacheMovieStatus({ status }: { status: CacheState }) {
  const Icon = status === "fresh" ? Check : CircleAlert;
  const tone = status === "fresh" ? "fresh" : status === "removed" ? "text-destructive" : "expired";
  return <span className={`movie-status ${tone}`}><Icon aria-hidden="true"/>{cacheStates[status]}</span>;
}
