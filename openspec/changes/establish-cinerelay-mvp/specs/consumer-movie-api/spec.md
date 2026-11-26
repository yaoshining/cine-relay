## ADDED Requirements

### Requirement: 独立外部鉴权及文档

系统 SHALL 提供经应用级鉴权的电影详情 API，并在 `/docs/api` 用 Scalar 展示相同的公开 OpenAPI 契约。VidAll 凭据只由其服务端持有，并且可撤销。

#### Scenario: 查看文档与调用 API

- **WHEN** 调用方打开公开文档，随后未携带有效凭据调用详情接口
- **THEN** 文档可见但不展示管理接口或真实密钥，详情接口拒绝调用

### Requirement: 缓存优先详情

系统 SHALL 对 `GET /api/v1/movies/{tmdbId}` 按电影 ID 和语言查询缓存；有效命中不访问上游，缺失时对同键并发请求合并回源。

#### Scenario: 有效缓存命中

- **WHEN** 持有效凭据的调用方请求有未过期记录的 ID 和语言
- **THEN** 系统返回该详情，不调用 TMDB 或 Inngest

#### Scenario: 缓存过期且上游暂时不可用

- **WHEN** 缓存已过期且 TMDB 暂时不可用
- **THEN** 系统只在允许保留期内返回标记过期的旧值；否则返回可重试错误，不将上游故障认定为下架
