import { requireAdmin } from "@/lib/admin/guard";
import Overview from "./view";

export default async function Page() {
  await requireAdmin();
  return <Overview />;
}
