import { requireAdmin } from "@/lib/admin/guard";
import NewJob from "./view";

export default async function Page(props: Parameters<typeof NewJob>[0]) {
  await requireAdmin();
  return <NewJob {...props} />;
}
