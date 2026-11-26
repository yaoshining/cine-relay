import { requireAdmin } from "@/lib/admin/guard";
import DesignSystem from "./view";

export default async function Page() {
  await requireAdmin();
  return <DesignSystem />;
}
