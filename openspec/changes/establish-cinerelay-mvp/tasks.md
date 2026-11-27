## 1. 项目骨架与安全

- [x] 1.1 初始化 Next.js、TypeScript、Tailwind 和 shadcn/ui；建立本地与 CI 测试流程，保留已验证脚本。静态后台已通过桌面与移动端视觉验收，覆盖八个导航页；使用合成数据，不连接生产服务。真实查询、鉴权、调度和 API 仍由下列未完成任务跟踪。
- [x] 1.2 建立服务端 Drizzle 映射与缓存精确读取，追加 0002 而不修改 0001；已用合成数据验证空库、旧数据升级、旧导入器兼容、新增约束和失败回滚。生产执行留到 3.3。
- [x] 1.3 实现 Auth.js GitHub ID 白名单、逐页与管理 API 服务端守卫、OAuth 准入审计和真实审计页；生产构建已用合成 OAuth 流程及 PGlite 验证拒绝、撤销和审计失败路径；真实 GitHub OAuth 已在本地验证受邀登录及审计写入。完整业务验收与生产部署留到 2.5／3.3。

## 2. 首条可验收链路

- [x] 确定界面视觉与核心页面布局规范并写入 `design.md`（概念预览图仅存放在 `.local/`）。
- [x] 2.1 实现受保护的只读电影查询与详情；已用合成数据验证 ID／片名、语言／状态、分页、缺译文、无数据与数据库故障，且不触发回源。已导入真实电影的联调留到 2.5。
- [x] 2.2 接通任务模板表单、独立配置快照、操作审计、Inngest 立即派发／安全重派和真实试抓结果页；最多 5 部，不入电影库、不推进游标。PGlite 和生产 HTTP 测试覆盖快照独立、签名校验、限流中止、失败状态与终态重放；真实 TMDB／Inngest 联调留到 2.5，正式入库由 2.3 开放。
- [x] 2.1.1 在电影库网格和详情显示真实缓存海报，并验证合法路径与无图回退。
- [x] 2.2.1 本地开发验证：现有 Inngest 端点支持无副作用的选片验证；通过 Dev Server MCP 验证注册、运行完成及持久化步骤的输出（接受有效范围并去除重复类别）。生产构建 HTTP 测试验证本地开关不解除签名校验。
- [x] 2.3 实现已保存回填模板的立即同步（≤10 部）、0004 运行条目、原子幂等入库、逐项进度、安全重派与仅重试未完成项。PGlite 和生产 HTTP 验证写入失败回滚、只重试写入、429 停止、终态重放、旧快照／下架保护；0004 已用于本机预览，真实 Inngest／TMDB 联调及生产迁移仍留到 2.5／3.3。
- [x] 2.4 完成应用密钥签发／撤销、缓存优先详情 API、同键租约、共享闸门、OpenAPI 和 Scalar。PGlite 与生产 HTTP 验证密钥隔离、命中／回源／限流、并发与期限边界。真实 VidAll 联调留到 2.5。
- [x] 2.4.1 恢复 `/docs/api` 的 Scalar 官方 CSS。生产构建 HTTP 回归验证样式资源；浏览器核对 1440px 桌面原生侧栏和 390px 窄屏布局均正常、无页面横向溢出，交互测试请求保持隐藏。
- [x] 2.4.2 `/docs/api` 的 Scalar 铺满视口，保留悬浮的 CineRelay 首页入口。生产构建验证 1440px 与 390px 布局从左上角开始、无横向溢出、悬浮链接可点击；匿名返回首页时进入原登录页。PR #3 已合入 `main`（`8544a14`），Vercel Production `FqSFdPY1DRXNdfKwCdR2bN23mVjj` 为 Current / Ready；正式域的 Scalar CSS 与 OpenAPI 返回 `200`，在 1200px 和 390px 宽度均验证从左上铺满、无横向溢出、返回链接可见。
- [x] 2.4.3 管理员会话同时保护 Scalar 页面与 OpenAPI JSON；交付可离线读取且与服务端一致的仓库契约。生产构建 HTTP 测试通过：匿名、有效外部 Bearer 与撤权身份不能读取文档（含 RSC 导航），受邀身份可读取且响应不可缓存；在线 JSON 与仓库文件一致，仓库文件不被 Web 服务公开，电影 API 仍要求独立 Bearer。已推送 `staging`（`37ffe9f`），Preview `GT6oC9AEkACJGAii1aRcx2E2kVb3` 已 Ready；固定预览域复测匿名页面 `307` 到 `/login`、JSON `401`，真实 GitHub 受邀会话加载 Scalar 与 JSON `200`，JSON 禁止缓存。PR #4 经 4 项检查通过后合入 `main`（`a5b8415`），Vercel Production `57HZhFi6PqMAKsjhsj2eaupHJZSG` 为 Current / Ready。正式域实测匿名 `307`／`401`，真实受邀会话可加载 Scalar，JSON `200`、`Cache-Control: no-store`、`EO-Cache-Status: MISS`；匿名请求不返回契约。
- [ ] 2.5 验证受邀登录、查到已导入电影、试抓、正式小批入库、VidAll 服务端凭据调用；验证未授权和失败路径。已在 `staging` 固定域名验证受邀管理员的真实 GitHub 会话、后台首页和 `admin.oauth.admission` 成功审计；真实本地 GitHub 登录及模拟未授权／故障也已验证。只读复查确认 `cinerelay-staging` 的电影、译文和同步运行均为 0；现有运行角色不能创建运行、写电影或签发外部密钥。Vercel 变量元数据显示 `INNGEST_EVENT_KEY` 仅在 Production，Preview 有 Signing Key，未见测试 TMDB 配置；未登录的 HTTPS 请求访问固定预览 `/api/inngest` 会被 Vercel 部署保护重定向。已在 `staging` Preview 独立保存 `TMDB_KEY_ENCRYPTION_KEY`，并在隔离库验证凭据插入、审计、启停与闸门更新权限（测试事务回滚，无凭据留存）；电影、运行及外部密钥仍不可写。部署后管理员已通过表单录入一条启用的 TMDB 凭据；只读核对隔离库确认存在一条 `tmdb.credential.added` 成功审计。凭据尚无上游检查时间，待首轮试抓验证。已为隔离角色追加 `sync_job_runs` 必需字段权限，并以回滚事务验证试抓创建、审计、派发失败／重派、运行及摘要完成；电影、模板及外部密钥仍无写入授权。经确认已配置 CineRelay 项目级 Vercel Protection Bypass for Automation，仅交给 Inngest 集成；固定预览的无签名 POST 即使通过部署保护仍返回 `401 signature_required`。已出现独立 Inngest `staging` 分支（`staging-8fbab988`），Preview 的 `staging` 单独配置非生产 Event Key（仅允许试抓事件）和 `INNGEST_ENV=staging`；未改生产事件凭据。初始自动化凭据已轮换并撤销；复测旧凭据被 Vercel 拦截，新凭据到达应用后仍需签名。最新 Preview `AjL8nXYTC1w4cPsTBMtQz95rW3LM` 已同步。首次试抓派发因配置误存掩码而失败，改用实际分支凭据后以原 CineRelay 运行 `57945515-8e73-4844-bb0a-e196835c8037` 安全重派，Inngest `sync-sample` 运行 `01M8ECW6S01HW7N0JV01VAZJJM` 在 `staging` 完成（`2026-11-27T11:40:02Z`）；诊断返回 1 部，凭据健康，电影／译文仍各 0 行。小批入库、已入库电影查询及 VidAll 非生产 Bearer 联调仍待验收；现有事件密钥没有放开回填事件。

- [x] 2.5.1 修复已有有效会话被失败回调带到登录错误页的问题，不更改 OAuth 校验。生产构建验证重复回调仍被拒绝、不改会话、不重复写成功审计，无会话或已被撤销仍显示错误。`staging` Preview `aaba45b` 已 Ready；固定域名用原有真实会话访问缺少一次性数据的回调，自动返回后台，审计未变化。

- [x] 2.5.2 在 PGlite 应用 `0001`–`0007`，演练首次手动回填的最小权限。模拟试抓角色创建正式运行时被拒绝且未留运行记录；追加必要列权限后，一部合成电影及译文成功入库、留有操作审计，可按 ID 查询。DDL、下架、删除、模板／游标修改和密钥签发仍被拒绝。
- [x] 2.5.3 `staging` 首次手动回填与后台查询验收通过。经确认接受非生产分支 Event Key 共享边界，仅为专用 Key 临时增放回填事件，并为隔离库应用角色临时追加列权限。使用禁用定时的单片模板，CineRelay 运行 `39161540-b27e-4610-9efe-492ee523435d` completed、唯一条目 stored，Inngest `sync-backfill` 运行 `01M8F2NHH9R8751VTTFQ4XAVVN` Completed。受邀管理员在固定 Preview 按 TMDB ID 查到 zh-CN 译文并打开详情。验收后已撤回新增列权限，复核不能创建正式运行或插入电影；重新加载 Event Key 确认仅允许原试抓事件。未开启扫描、未改生产。VidAll 服务端 Bearer 在 2.5 单独验收。

## 3. 自动化与生产接入

- [x] 3.1 实现每小时扫描、每日／每周北京时间计划、增量窗口与游标、待处理队列和安全重派发。PGlite 验证范围变化、过时快照拦截、游标与入队失败一起回滚；生产构建 HTTP 模拟验证定时签名执行、按槽去重和同 ID 派发。云端烟测留到 3.3，默认不开启扫描。
- [x] 3.2 实现加密的多 TMDB 凭据管理及共享限额和冷却状态。PGlite 与生产构建 HTTP 模拟验证凭据隔离、跨请求共享退避与 429 不轮换。未配置真实上游凭据。
- [ ] 3.3 配好 Vercel／Neon／Inngest 生产配置，显式迁移后烟测；核对 TMDB 对外服务授权与署名。Vercel 项目 `cine-relay` 已关联 GitHub 仓库，Production 两个 Inngest Key 已就绪；应用凭据、隔离库验收及生产迁移尚待完成。日常 PR 默认进入 `staging`；将 `9702438` 合入后已验证 Vercel 目标为 Preview、状态为 Ready，`main` 未变。独立的 staging GitHub OAuth App 回调及仅限 staging 的 `AUTH_URL` 已配置；Neon `cinerelay-staging` 结构分支已显式迁移至 `0007`，池连接已用回滚事务验证非所有者角色能写审计、不能执行 DDL 或写电影。GitHub 本人确认后已把 OAuth、白名单及隔离库变量写入 Vercel，仅限 `staging`；同一提交重新部署后已确认 Preview Ready、GitHub `redirect_uri` 匹配固定域名；受邀管理员的真实会话及审计已在 2.5 验证。首次验收先有 `CallbackRouteError`，随后审计成功，再出现 `InvalidCheck` 和通用错误页；有效会话未被撤销。用本地生产构建及模拟 GitHub 复现了成功后重复回调导致相同错误页、原会话和唯一成功审计保留；线上缺少足够证据把额外回调归因为重复访问。`main` 的 `0c952db` 已部署到 Vercel Production（`cine-relay.vercel.app`）。已注册独立生产 GitHub OAuth App，精确回调 `https://cine-relay.vidall.top/api/auth/callback/github`；Vercel Production 已配置公开 origin、独立会话密钥、Client ID 与管理员白名单。生产 GitHub Client Secret 已保存。经授权为 Neon `main / cine_relay` 建立短期恢复快照，再按事务应用 `0002`–`0007`，现有表行数不变；通过非所有者连接验证读取、可插入审计（验证事务回滚）及不能写电影或创建表。Vercel Production `DATABASE_URL` 已保存；Vercel 本人确认后 Production 重部署已 Ready，正式域名 `/api/auth/providers` 返回 200。EdgeOne 上登录 POST 的来源校验问题及真实登录验收见 3.4.1；Inngest、只读缓存及外部 Bearer 等生产烟测仍待完成。
- [ ] 3.4 在已有 `vidall.top` EdgeOne 站点新增 `cine-relay.vidall.top`，HTTPS 回源 Vercel Production 稳定域名 `cine-relay.vercel.app`；初始全路径绕过缓存。已按授权创建该加速域名，核对回源为 `cine-relay.vercel.app:443` 且 Host 为 `cine-relay.vercel.app`，仅新域名匹配启用 `NoCache` 和响应 `Cache-Control: no-store`，保留境外地域和其他子域。EdgeOne 域名已在线、证书已部署，DNSPod 当前有启用的 EdgeOne CNAME。正式域名已通过外部 HTTPS 验证并回源 Vercel；公开 OpenAPI 200，匿名审计与电影 API 均 401，已检查路径的 `EO-Cache-Status` 为 `MISS`。正式域名的 OAuth 已在 3.4.1 验收；`8544a14` 部署后从正式域验证无签名 Inngest POST 返回应用层 `401 signature_required`，相关烟测响应的 `EO-Cache-Status` 均为 `MISS`；仍需验证带签名的 Inngest 请求及有效外部 Bearer 请求。
- [x] 3.4.1 修复 EdgeOne 正式来源被 Next.js Server Action 拒绝的问题；生产构建已验证精确公开来源可发起 GitHub 登录，而其他子域和后缀相似域名无重定向、无 Cookie。修复已经 PR #2 合入 `main`（`fb14463`），Vercel Production 已 Ready。首次 GitHub 回调记录 `InvalidCheck` 且未产生会话和审计，尚未确定具体 Cookie 校验失败原因。重新从正式域名发起授权后正常回跳到后台，验证受邀会话、审计 API 200 及生产 Neon 的 `admin.oauth.admission` 成功记录。
- [ ] 3.5 核对首周 Inngest 与 Neon 用量、运行历史及失败恢复；通过相关测试和 OpenSpec 严格校验后归档。
