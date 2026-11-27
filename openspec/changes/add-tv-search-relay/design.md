# Design

## Context
现有外部 API 使用可撤销 Bearer；电影详情支持读穿缓存和刷新租约。现有 managedTmdbClient 返回电影客户端，网络调用经过 withTmdbPermit、凭据池和 429 共享冷却。新功能沿用这些边界而不复用电影表主键。

## Goals / Non-Goals
首版提供可用线索和可解释的预取优先级。不接收用户标识、原始文件名或本地路径；不做全季预抓、不做后台可视化排行榜、不改 VidAll 的选择策略。

## Decisions
- 四条固定消费端路由：GET /api/v1/search/tv（query、first_air_date_year、lang、page），POST /api/v1/search/tv/confirm（searchId、seriesId），GET /api/v1/tv/{seriesId}（含 seasons 摘要），GET /api/v1/tv/{seriesId}/season/{season}/episode/{episode}。搜索由 VidAll 生成 UUID 并通过 X-Search-Id 传入，一次逻辑操作含所有分页与重试；不同操作换新 UUID。服务端从已验证 Bearer 取得凭据 ID，不接受调用方自报身份。
- 搜索词仅做 Unicode NFC、首尾去空格及连续空白合并；1–120 字，page 1–500；缺省 zh-CN，首版支持 zh-CN/en-US，排除成人结果，季号允许 0（特别篇）。不翻译、模糊匹配或把同名候选合并。缓存键为版本化规范化参数（含 page），分桶词频不含 page。两类详情按语言独立，复用 7 天新鲜／30 天保留策略；并发未取得租约者重读，有可用旧值则 stale，否则 503 + Retry-After。
- 增量 SQL 和 Drizzle schema：搜索页、剧集译文及季摘要、单集译文、查询／详情短租约；单独存逻辑搜索与已展示候选 ID、确认事件。唯一键 (credentialId, searchId)，绑定词、年份与语言，同 ID 不同条件或改选返回 409。成功返回页面时同事务去重记数与并入已展示 ID；确认同事务校验归属并幂等写入，重复同选成功。操作满 24 小时不再接受确认；按事件时间计算滑动 24 小时热度，过期记录定期清理，不保存 Bearer。受保护管理侧可查询词频和剧集确认次数，不向消费方公开全局统计。
- 初始可调参数：同剧同语言 24 小时至少 3 次不同搜索确认才入队，每轮至多取前 10，按确认数、最近确认时间、ID 稳定排序。按 (seriesId,lang) 唯一待办；有界 worker 每次只处理一部，执行前重查新鲜度、租约、冷却和剩余预算；低于 20% 小时余量则不派预取。前台优先，预取不占用专用并发槽之外的额外上游额度。单次剧集详情响应携带季列表，无需枚举季或集。
- 独立启用开关默认关闭；staging 使用合成数据、隔离库与限量真实请求。同步本地 OpenAPI 契约与受保护 Scalar；VidAll_Server 跨仓单独实施。电影接口不变。

## Risks / Trade-offs
模糊命中会误热，故允许不确认，按用户或可靠自动匹配的实际选择记热；统计仅代表 VidAll 请求而非人数。限制每凭据请求速率、查询长度和候选留存以控制高基数写入。429、5xx 与数据库错误不能污染搜索负缓存。通过回滚开关停止 worker；迁移只增结构，不自动在生产执行。元数据保留及对外提供范围应在生产启用前确认。
