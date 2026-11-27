import { writeFileSync } from "node:fs";
import { tvPreviewContract } from "../src/lib/consumer/tv-contract";
import { consumerOpenApi } from "../src/lib/consumer/openapi";

writeFileSync(
  new URL("../openspec/contracts/consumer-movie-api.openapi.json", import.meta.url),
  JSON.stringify(consumerOpenApi, null, 2) + "\n",
);
writeFileSync(new URL("../openspec/contracts/tv-relay-preview.openapi.json", import.meta.url),
  JSON.stringify(tvPreviewContract, null, 2) + "\n");
