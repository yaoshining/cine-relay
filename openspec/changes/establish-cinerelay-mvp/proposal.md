## Why

CineRelay 已验证本地抓取、快照校验和批量导入；首批快照包含 500 条 zh-CN 记录。下一步把手动链路升级为可观察、可恢复的影视元数据缓存服务，让管理员配置任务并核验结果，让 VidAll 服务端安全地复用数据。

## What Changes

- 新增仅受邀管理员可进入的管理后台，提供任务总览、运行历史、电影查询、凭据管理与关键操作审计。重复 OAuth 回调被拒绝后，已有有效管理员会话可继续进入后台。
- 用表单配置选片范围、类别、原片语言、译文语言和抓取字段；支持一次性回填、增量同步、手动立即运行和定时运行。正式任务前可以试抓最多 5 部，不写电影库、不推进游标。
- 支持多个 TMDB 凭据，共享回源并发预算和冷却状态；以缓存、并发合并及退避应对限流，不轮换凭据绕过 429。
- 首个外部接口为 `GET /api/v1/movies/{tmdbId}?lang=zh-CN`，由 VidAll 服务端持有访问凭据；`/docs/api` 用 Scalar 展示外部 OpenAPI 契约。
- 继续使用 Vercel、现有 Neon PostgreSQL，Inngest 负责后台编排，EdgeOne 负责国内访问加速。

## Capabilities

### New Capabilities

- `admin-console`：受邀登录、只读电影查询和操作审计。
- `movie-sync`：任务模板、试抓、回填、增量调度和进度追踪。
- `tmdb-access-pool`：上游凭据管理、请求预算、冷却和故障切换。
- `consumer-movie-api`：外部电影详情 API、应用鉴权和公开文档。
- `deployment-workflow`：把日常 PR 的 Preview 验收与 `main` 生产发布分开。

### Modified Capabilities

无已归档规范。保留既有脚本及兼容的快照格式。

## Impact

- 在现有 Neon 项目的 `main / cine_relay` 追加迁移，不覆盖初始迁移。1.2 用本地合成数据验证向后兼容；Vercel `staging` 使用现有 Neon 项目内仅复制结构的独立分支，不复制生产行。生产应用迁移留到 3.3。
- 部署增加 Vercel Web／任务端点、Inngest 托管运行和 EdgeOne 边缘入口；外部发布前核对 TMDB 授权及署名要求。
- 第一个里程碑先跑通「登录 → 查询 → 试抓 → 小批正式入库 → 用服务端凭据验证 API 和文档」。验收后再开每日自动同步、多凭据管理和 EdgeOne 接入。
- 不做剧集、开放透传、外部片名搜索 API、海报镜像、拖拽编排、公开注册、复杂 RBAC 或人工编辑电影元数据。旧 ID 映射和自动下架对账不纳入本变更。
