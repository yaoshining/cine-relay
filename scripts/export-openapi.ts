import { writeFileSync } from "node:fs";
import { consumerOpenApi } from "../src/lib/consumer/openapi";

writeFileSync(
  new URL("../openspec/contracts/consumer-movie-api.openapi.json", import.meta.url),
  JSON.stringify(consumerOpenApi, null, 2) + "\n",
);
