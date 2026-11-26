import { requireAdmin } from "@/lib/admin/guard";
import RunDetail from "./view";

export default async function Page(props: Parameters<typeof RunDetail>[0]) {
  await requireAdmin();
  return <RunDetail {...props} />;
}
