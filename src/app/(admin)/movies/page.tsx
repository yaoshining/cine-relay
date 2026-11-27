import { Catalog } from "@/components/catalog";
import { requireAdmin } from "@/lib/admin/guard";
import { getDb } from "@/lib/db/client";
import { listMovieCatalog } from "@/lib/db/movie-catalog";
import { parseCatalogParams, type MovieSearchParams } from "@/lib/movie-catalog";

async function readCatalog(filters: ReturnType<typeof parseCatalogParams>) {
  try {
    return await listMovieCatalog(getDb(), filters, new Date().toISOString());
  } catch {
    return null;
  }
}

export default async function Page({ searchParams }: { searchParams: Promise<MovieSearchParams> }) {
  await requireAdmin();
  const filters = parseCatalogParams(await searchParams);
  return <Catalog filters={filters} result={await readCatalog(filters)}/>;
}
