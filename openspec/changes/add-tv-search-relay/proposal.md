# Proposal

## Why
VidAll 从文件名只能得到剧名和季集号，现有电影 ID 接口无法找到剧集。重复刮削既不应重复查询 TMDB，也不应让重名搜索把错误剧集推入库。

## What Changes
- 增加受 Bearer 保护的剧名分页搜索、剧集详情（含季列表）、按季集号查询单集，以及搜索匹配确认。
- 分开统计逻辑搜索次数和已确认的剧集热度。用最近 24 小时的热度优先缓存剧集元数据，不批量下载单集，不存视频。
- 本变更接续电影 MVP，扩展其原先明确排除的剧集范围；不改变现有电影接口，不提供任意 TMDB URL 透传。

## Capabilities
### New Capabilities
- `tv-scrape-relay`：缓存搜索候选、解析剧集和单集、记录需求与调度热门剧预取。

### Modified Capabilities
无。

## Impact
涉及 Next.js 路由、消费凭据校验、共享 TMDB 闸门、Neon 增量迁移、Inngest 和 OpenAPI。VidAll_Server 需配套解析、选择与确认；其用户绑定属于 VidAll，不进入公共缓存。生产启用另行确认。
