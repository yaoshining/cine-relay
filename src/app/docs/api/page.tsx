import Link from "next/link";
import { PublicApiReference } from "@/components/public-api-reference";

export default function ApiDocs() {
  return <section>
    <h1 className="sr-only">CineRelay API</h1>
    <p className="mb-4 text-sm text-muted-foreground">应用密钥仅由调用方服务端保存。<Link className="text-link" href="/api/v1/openapi.json">下载 OpenAPI 契约</Link></p>
    <PublicApiReference/>
  </section>;
}
