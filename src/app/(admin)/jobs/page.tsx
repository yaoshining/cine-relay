import { requireAdmin } from "@/lib/admin/guard";
import Jobs from "./view";

export default async function Page(props: Parameters<typeof Jobs>[0]) {
  await requireAdmin();
  return <Jobs {...props} />;
}
