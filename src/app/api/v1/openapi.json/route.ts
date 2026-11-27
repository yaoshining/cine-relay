import { getAdmin } from "@/lib/admin/guard";
import { consumerOpenApi } from "@/lib/consumer/openapi";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-store" };

export async function GET() {
  if (!(await getAdmin())) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers });
  }
  return Response.json(consumerOpenApi, { headers });
}
