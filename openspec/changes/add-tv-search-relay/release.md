# CineRelay 自有发布与生产交付

## 放行边界
VidAll_Server 只连接 `https://cine-relay.vidall.top`。以下预览步骤由 CineRelay 执行。未核实生产上游凭据、数据使用范围、运行角色权限和正式域真实响应之前，不宣布可接入。上游使用 CineRelay 自己的合法凭据，不从 staging 复制密钥。后台 Bridge / EdgeOne 规则不因新路由而放宽。

1. 在隔离库验证恢复点、既有电影与密钥表，事务应用 `db/migrations/0008_tv_relay.sql`；它只创建 TV 表和索引，不赋权。应用角色需有 consumer_keys 的鉴权读取权限、tv_request_windows 的 SELECT/INSERT/UPDATE、tv_cache 和 tv_search_operations 的 SELECT/INSERT/UPDATE 及过期清理 DELETE。不要向应用授予 DDL 或电影写权限。复核现有共享 TMDB 闸门和凭据池的最小读取、闸门及健康字段更新权限。
2. 内部预览用受邀管理员创建短期测试 Bearer。针对已有授权使用范围，搜一个真实剧名，按候选 seriesId 确认，查询剧集与一集；核对首次 refreshed、再次 hit、401/409 和统计去重。单独启用 CINERELAY_TV_PREFETCH=1 才注册剧集预取 cron（每 10 分钟一次，不开启电影扫描），验证热门对象的季摘要提前入库、单集未被枚举。撤销临时凭据，按现有发布流程审批至 main。
3. 生产迁移、配置和上线后，在正式域复验整个链路及撤销：匿名 401、有效 Bearer 搜索和确认、剧集与单集读穿、上游限额和预取状态。失败时停止交付，关闭预取、撤销测试凭据，必要时回退部署，保留增量表；不自动删除数据。确认缓存与搜索操作过期清理在运行。

## 放行后的 VidAll 接入
正式域使用独立服务端 Bearer，不提供环境切换或 Preview 绕过密钥。调用参数、响应及错误以 `openspec/contracts/consumer-movie-api.openapi.json` 为准，在线文档继续仅对 CineRelay 管理员开放。

以合成文件 `星港档案.2023.S01E05` 说明：VidAll 解析剧名和年份，用新 UUID 作 `X-Search-Id` 调用 `GET /api/v1/search/tv?query=星港档案&first_air_date_year=2023&lang=zh-CN`。翻页与重试复用 UUID，按搜索响应而非硬编码取候选 ID。成功匹配后 POST `/api/v1/search/tv/confirm`，JSON 为 `{ "searchId": "<同一 UUID>", "seriesId": "<候选 ID>" }`。保存本地绑定 `(tv,seriesId)`，读取 `/api/v1/tv/{seriesId}?lang=zh-CN` 和 `/api/v1/tv/{seriesId}/season/1/episode/5?lang=zh-CN`，同剧下一集复用绑定。遇 401 不盲重试、409 不强行改选，429 与 503 遵循 Retry-After。
