import { requireAdmin } from "@/lib/admin/guard";
import EditJob from "./view";

export default async function Page(props: Parameters<typeof EditJob>[0]) {
  await requireAdmin();
  return <EditJob {...props} />;
}
