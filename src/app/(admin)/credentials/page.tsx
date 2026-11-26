import { requireAdmin } from "@/lib/admin/guard";
import Credentials from "./view";

export default async function Page() {
  await requireAdmin();
  return <Credentials />;
}
