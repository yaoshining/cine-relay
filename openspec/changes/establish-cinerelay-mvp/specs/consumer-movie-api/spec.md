## ADDED Requirements

### Requirement: 独立外部鉴权及文档

系统 SHALL 提供经应用级鉴权的电影详情 API，并仅向持有当前受邀管理员会话的用户提供 `/docs/api` 与 `/api/v1/openapi.json`。VidAll 从仓库本地的 `openspec/contracts/consumer-movie-api.openapi.json` 使用同一份契约，调用详情接口仍使用其服务端持有、可撤销的独立凭据。

#### Scenario: 管理员查看 Scalar API 文档

- **WHEN** 持有效受邀会话的管理员打开 `/docs/api`
- **THEN** 页面使用 Scalar 官方样式和完整视口布局，提供「返回 CineRelay」悬浮入口，使用同源管理员会话加载 OpenAPI，不展示管理接口或密钥，不开启网页测试请求；文档页与 JSON 均不可缓存

#### Scenario: 拒绝未授权文档访问

- **WHEN** 请求缺少有效受邀会话（包括匿名、仅持外部 Bearer 或管理员已撤权）
- **THEN** 文档页转至 `/login`，OpenAPI 请求返回 `401` 及不可缓存的错误，两者均不返回契约

#### Scenario: 使用本地契约与独立 API 凭据

- **WHEN** VidAll 从仓库读取本地 OpenAPI 文件并调用电影详情接口
- **THEN** 本地文件与受保护的 JSON 端点契约相同；详情接口仍只接受有效应用 Bearer，管理员会话不能替代它

#### Scenario: 签发和撤销应用密钥

- **WHEN** 管理员签发或撤销独立的外部应用密钥
- **THEN** 签发时仅展示一次随机密钥；撤销后原密钥立即失效，审计不包含密钥原文或哈希

### Requirement: 缓存优先详情

系统 SHALL 对 `GET /api/v1/movies/{tmdbId}` 按电影 ID 和语言查询缓存；有效命中不访问上游，缺失时对同键并发请求合并回源。

#### Scenario: 有效缓存命中

- **WHEN** 持有效凭据的调用方请求有未过期记录的 ID 和语言
- **THEN** 系统返回该详情，不调用 TMDB 或 Inngest

#### Scenario: 同键并发回源

- **WHEN** 授权调用并发请求缺失或过期的同一电影和语言
- **THEN** 持有数据库租约的请求才回源；其他请求可复用最新缓存或仍可保留的旧值，无缓存时返回带重试时间的 503

#### Scenario: 缓存过期且上游暂时不可用

- **WHEN** 缓存已过期且 TMDB 暂时不可用
- **THEN** 系统只在允许保留期内返回标记过期的旧值；否则返回可重试错误，不将上游故障认定为下架
