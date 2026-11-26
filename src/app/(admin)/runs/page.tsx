import { requireAdmin } from "@/lib/admin/guard";
import Runs from "./view";

export default async function Page() {
  await requireAdmin();
  return <Runs />;
}
