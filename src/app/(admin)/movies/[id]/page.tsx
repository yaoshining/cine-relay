import { requireAdmin } from "@/lib/admin/guard";
import MoviePage from "./view";

export default async function Page(props: Parameters<typeof MoviePage>[0]) {
  await requireAdmin();
  return <MoviePage {...props} />;
}
