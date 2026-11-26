import { requireAdmin } from "@/lib/admin/guard";
import MoviesPage from "./view";

export default async function Page(props: Parameters<typeof MoviesPage>[0]) {
  await requireAdmin();
  return <MoviesPage {...props} />;
}
