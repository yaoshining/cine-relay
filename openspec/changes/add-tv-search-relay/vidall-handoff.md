# CineRelay 内部合成测试（不作为 VidAll 接入步骤）

对 VidAll_Server 仅交付经正式域验收的生产服务。下述说明只供 CineRelay 开发与回归使用。

当前可用的是本机消费契约与合成数据服务，不是云端 TV API。机器可读契约：[tv-relay-preview.openapi.json](../../contracts/tv-relay-preview.openapi.json)。命令在 CineRelay 根目录运行：`npm ci`（首次）、`npm run dev:tv-fixture`。服务只绑定 `127.0.0.1:4317`；在同机 VidAll 开发进程或本地 HTTP 测试调用，不能从 Vercel dev 访问回环地址。不要修改生产 origin 白名单来接这个示例。

服务端配置：本地 base URL `http://127.0.0.1:4317`，演示 Bearer 固定为 `vidall-local-fixture`，不使用真实秘密、Vercel OIDC 或 TMDB token。本机 fixture 的命中状态仅保存在进程内，重启即清空，不模拟线上 TTL、限流、持久化或预取。客户端只调用 VidAll，不直接访问中继。

以合成文件 `星港档案.2023.S01E05.mkv` 为例，VidAll 解析出剧名、年份、季集号；一次逻辑搜索生成一个 UUID，翻页及重试复用。以下命令可依次执行：

```sh
base=http://127.0.0.1:4317/api/v1
auth='Authorization: Bearer vidall-local-fixture'
sid=$(node -p 'crypto.randomUUID()')
curl -fsSG "$base/search/tv" -H "$auth" -H "X-Search-Id: $sid" --data-urlencode 'query=星港档案' -d first_air_date_year=2023 -d lang=zh-CN
curl -fsS "$base/search/tv/confirm" -H "$auth" -H 'Content-Type: application/json' -d "{\"searchId\":\"$sid\",\"seriesId\":\"910001\"}"
curl -fsS "$base/tv/910001?lang=zh-CN" -H "$auth"
curl -fsS "$base/tv/910001/season/1/episode/5?lang=zh-CN" -H "$auth"
```

VidAll 从 `results[].seriesId` 选取，不硬编码示例 ID；确认后本地保存 `(tv, seriesId)`，后续单集复用绑定。去掉年份并换新 UUID，能测试同名歧义：本地每页一个候选，第 2 页是 2025 年的另一部剧。重复同选应返回 200，改选或选择该操作未展示的候选返回 409。重放单集查询可测 `refreshed → hit`。无候选应保留未匹配状态。`401` 与无候选不同，不重试无效凭据；真实服务的 `503` 按 `Retry-After` 有界重试，可先用下游测试替身覆盖。

真实迁移和接口就绪后再做 staging 双服务联调，届时另行签发测试凭据、核对受保护 Preview 的短期部署身份；本机结果不能勾选云端验收。
