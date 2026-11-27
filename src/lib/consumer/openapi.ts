import { tvPaths } from "./tv-contract";
import { z } from "zod";

export const consumerMovieSchema = z.object({
  tmdbId: z.string().regex(/^[1-9][0-9]{0,18}$/),
  locale: z.enum(["zh-CN", "en-US"]),
  title: z.string(),
  originalTitle: z.string().nullable(),
  overview: z.string().nullable(),
  posterPath: z.string().nullable(),
  releaseDate: z.iso.date().nullable(),
  genreIds: z.array(z.number().int()),
  originalLanguage: z.string().nullable(),
  runtimeMinutes: z.number().int().nullable(),
  fetchedAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  cache: z.enum(["hit", "refreshed", "stale"]),
  stale: z.boolean(),
});
const media = (schema: object) => ({ "application/json": { schema } });
const retryAfter = { description: "建议等待秒数。", schema: { type: "integer", minimum: 1 } };
const failure = (error: string, description: string) => ({ description, content: media({
  type: "object", required: ["error"], properties: { error: { type: "string", const: error } }, additionalProperties: false,
}) });

export const consumerOpenApi = {
  openapi: "3.1.0",
  info: { title: "CineRelay API", version: "1.0.0", description: "从服务端调用；不要将应用密钥嵌入网站或客户端。" },
  servers: [{ url: "/" }],
  components: { securitySchemes: { AppKey: { type: "http", scheme: "bearer" } } },
  security: [{ AppKey: [] }],
  paths: {
    ...tvPaths,
    "/api/v1/movies/{tmdbId}": {
      get: {
        operationId: "getMovie",
        summary: "获取单部电影详情",
        description: "按语言精确查找缓存。cache=stale 表示返回了仍在保留期内的过期值。",
        security: [{ AppKey: [] }],
        parameters: [
          { in: "path", name: "tmdbId", required: true, description: "正整数 ID，按十进制字符串传输。",
            schema: { type: "string", pattern: "^[1-9][0-9]{0,18}$" } },
          { in: "query", name: "lang", schema: { type: "string", enum: ["zh-CN","en-US"], default: "zh-CN" } },
        ],
        responses: {
          200: { description: "详情与缓存状态。", content: media(z.toJSONSchema(consumerMovieSchema)) },
          400: failure("invalid_request", "ID 或语言参数无效。"),
          401: { ...failure("unauthorized", "缺少有效服务端凭据。"), headers: { "WWW-Authenticate": { schema: { type: "string", const: "Bearer" } } } },
          404: failure("not_found", "电影不存在或已下架。"),
          503: { ...failure("unavailable", "暂不可用，按 Retry-After 重试。"), headers: { "Retry-After": retryAfter } },
        },
      },
    },
  },
};
