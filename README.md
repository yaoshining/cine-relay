<p align="center">
  <img src="docs/assets/cine-relay-mark.svg" width="112" height="112" alt="CineRelay 标志：连接两个节点的 C 形箭头">
</p>

<h1 align="center">CineRelay · 映桥</h1>

<p align="center">A cache-first movie metadata relay for VidAll, backed by TMDB.</p>

CineRelay 是为 [VidAll](https://github.com/yaoshining/vidall-tv) 设计的影视元数据中转站。VidAll 先查 CineRelay 的 Postgres；命中有效缓存时直接返回，只有首次缺失、缓存过期或后台同步命中变更时才请求 TMDB。多个 VidAll 客户端可以复用同一份数据，不必各自回源。

> 首个数据库迁移已应用到 Neon 的 `cine_relay` 数据库。首批 TMDB 数据由下方脚本手动导入；API 和增量同步任务尚未实现。

## 本地预览管理后台

需要 Node.js 22+ 与 Python 3。当前是使用合成数据的 1.1 视觉骨架，不需要配置 Neon、TMDB、GitHub OAuth 或 Inngest。

```bash
npm ci
npm run dev -- --hostname 127.0.0.1
```

打开 `http://localhost:3000`。各路由可从左侧导航进入；组件验收页在 `/design-system`。本地检查：`npm run lint`、`npm run typecheck`、`npm test`、`npm run build`。

## 项目规范与进度

接口契约、同步行为及实施进度见 [CineRelay MVP OpenSpec 变更](openspec/changes/establish-cinerelay-mvp/)。当前 `/docs/api` 仅供预览，VidAll 接口尚未上线。

## 本地预热：抓取 TMDB 详情

[`scripts/tmdb_prefetch.py`](scripts/tmdb_prefetch.py) 只需要 Python 3.10+ 标准库；不连接 Neon，也不下载海报。先到 [TMDB API 设置页](https://www.themoviedb.org/settings/api) 获取 **API Read Access Token**。在仓库根目录运行（Bash / Zsh）：

```bash
printf 'TMDB API Read Access Token: '
read -rs TMDB_READ_TOKEN; printf '\n'
export TMDB_READ_TOKEN

# 先固定并查看 5 部片单（不抓详情），然后复用该片单抓取并打印完整字段
python3 scripts/tmdb_prefetch.py --limit 5 --output-dir .tmdb-prefetch-smoke --list-only
python3 scripts/tmdb_prefetch.py --output-dir .tmdb-prefetch-smoke --verbose

# 正式首轮：最近一年（UTC）、全球首映日期、按热度最多取 500 部
python3 scripts/tmdb_prefetch.py
```

- 默认写入 `.tmdb-prefetch/manifest.json`（固定片单）和 `.tmdb-prefetch/movies.jsonl`（每行一部，含 `fetched_at`）。终端逐部显示 ID、片名、上映日期、简介长度和已保存进度；结束时汇总新增、跳过、失败和剩余数量。
- 失败或中断后**用同一目录重跑**，已保存的 ID 会跳过，失败的会重试。不要同时运行两个进程写同一个目录。可用 `--start-date` 和 `--end-date` 指定含首尾的日期范围；换日期或数量时请换目录。
- `zh-CN` 请求可能收到 TMDB 的回退标题或简介。脚本只生成本地待导入文件，不验证译文覆盖，也不写库。临时文件不进 Git，后续导入成功后清理；如自定义输出目录，也不要提交数据文件。

### 从个人 Bitwarden 密码库读取 Token

把 TMDB 的 **API Read Access Token** 存在专用「登录」条目的「密码」字段，或者存在「安全笔记」的正文或自定义字段中（同一条目里应只有一个不同的 JWT 格式 Token）。使用条目的 UUID，不要把 Token 放在命令行参数里。安装 [Bitwarden CLI `bw`](https://bitwarden.com/help/cli/) 后，在本机终端运行：

```bash
# 仅首次、尚未登录时运行；已登录则跳过
bw login --raw >/dev/null
# 如果条目刚从网页或桌面端创建，可先同步
bw sync

bash scripts/tmdb_prefetch_bw.sh '<条目 UUID>' --limit 5 --output-dir .tmdb-prefetch-smoke --verbose
```

包装脚本会复用已有的 `BW_SESSION`，否则由 `bw` 在交互终端提示解锁；仅从指定条目提取 Token，不把 Bitwarden 会话传给抓取程序。TMDB Token 不会打印或落盘。正式抓取时，去掉 `--limit 5 --output-dir .tmdb-prefetch-smoke --verbose` 即可。

## 导入本地快照到 Neon

在仓库根目录运行，需要 Node.js 22+ 和已登录的 Neon CLI：

```bash
npm ci
npm run import:tmdb -- --dry-run  # 只检查本地，不连接 Neon
npm run import:tmdb              # 写入 cine-relay 项目的 main / cine_relay
```

默认读取 `.tmdb-prefetch/`，可用 `--input-dir` 指定另一个完整快照。脚本先校验片单与 JSONL 一一对应，再通过 Neon HTTPS 在一个事务里批量写入。连接信息由 Neon CLI 获取，不打印、不落盘；无需 TMDB Token。仅较新的 `fetched_at` 会覆盖详情（电影公共字段也按快照时间更新），已标记下架的电影不会被此导入器恢复。同一快照可以安全重跑。缓存从 `fetched_at` 起 7 天过期，30 天达到清理期限；自动清理尚未实现。

## 数据库迁移

初始结构见 [`db/migrations/0001_initial.sql`](db/migrations/0001_initial.sql)。对新建的空数据库，用 PostgreSQL 直连地址执行一次：

```bash
psql "$DATABASE_URL" --single-transaction --set=ON_ERROR_STOP=1 \
  --file=db/migrations/0001_initial.sql
```

- `movies` 保存电影公共字段和确认下架的时间；`movie_localizations` 按 `(tmdb_id, locale)` 保存标题、简介、海报路径和缓存时效。
- `sync_cursors` 保存同步进度；`movie_sync_jobs` 按电影与语言去重，支持记录重试时间和任务租约，允许先入队、后抓取未见过的电影。
- `expires_at` 是正常缓存的过期时间；`purge_after` 是最晚保留时间。自动刷新、删除过期数据和任务消费由后续同步程序实现，建表本身不会自动执行这些操作。

## 数据授权与署名

本仓库放代码、文档、Logo 和合成测试数据，**不提交 API 密钥、TMDB 原始响应、海报或数据快照**。实际缓存位于部署方的 Postgres。大量回填、长期保留、对外提供元数据或用于付费产品前，先核对适用的 TMDB 条款和授权范围，不假设开发者 API 等同于可再分发许可。部署后的应用应按 [TMDB 署名要求](https://developer.themoviedb.org/docs/faq) 在「关于」或「鸣谢」中使用获准标志与免责声明。

> This product uses the TMDB API but is not endorsed or certified by TMDB.
