import { requireAdmin } from "@/lib/admin/guard";
import Consumers from "./view";

export default async function Page() {
  await requireAdmin();
  return <Consumers />;
}
