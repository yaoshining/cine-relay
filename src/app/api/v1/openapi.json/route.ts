import { consumerOpenApi } from "@/lib/consumer/openapi";

export const dynamic = "force-static";
export function GET() {
  return Response.json(consumerOpenApi);
}
