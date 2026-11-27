# CineRelay 开发约束

## OpenSpec：项目文档和规范

- 生成的概念图、截图和其他预览图片只存放在项目根目录下的 `.local/`（由 `.gitignore` 忽略）；不得放入 `openspec/` 或提交到 Git。OpenSpec 只记录方案、设计决策和选择结果，不嵌入图片，也不引用本机绝对路径。此限制不适用于正式功能所需的静态资源。
- OpenSpec 是项目文档和规范的唯一事实来源。当前生效的规范放在 `openspec/specs/`；待实施变更放在 `openspec/changes/<change-id>/`。需求、技术设计、验收标准和实施清单随对应变更维护；不要在聊天记录、README 或任务看板里另维护一份规范。README 只保留项目介绍、快速开始和相关入口。
- 在实现新功能、改变现有行为、数据库结构、外部 API 或任务流程前，先创建或更新对应的 OpenSpec 变更，写清提案、规范差异、技术设计和 `tasks.md` 实施清单。若仓库还未初始化 OpenSpec，先初始化，再开始首个功能变更。
- 实施中发现需要调整的设计或验收标准，先更新对应变更，再继续实现。对外 API 的 OpenAPI 契约和 `/docs/api` 展示必须与 OpenSpec 中的行为规范保持一致。
- 交付前运行 `openspec validate <change-id> --strict` 和相关测试；只勾选已完成并验证的任务。验收通过后按 OpenSpec 流程归档，并同步生效规范。

## 分支与预览发布

- `staging` 是固定的 Vercel Preview 验收分支。功能和修复可以在各自的分支开发；创建或更新日常 PR 时默认以 `staging` 为目标分支，合入后用固定分支 URL 验收。
- `main` 只用于生产发布；预览通过且明确获准上线后，才以 `main` 为发布 PR 的目标。不为生成预览而推送或合入 `main`。

## Pomodoist：开发进度

- 使用 Pomodoist 中已存在的 `CineRelay` 项目，不创建同名或替代项目。在该项目下按开发会话分组任务，同一会话内的多轮交流和多个 OpenSpec 变更归在同一组，不按变更或单条实施事项另建分组。可附相关 `<change-id>` 供追溯；实施细项以 OpenSpec 的 `tasks.md` 为准。
- 在同一会话分组内更新里程碑、已完成内容、下一步、阻塞和验证结果。跨会话继续同一变更时，沿用原 OpenSpec 变更，在当前会话分组记录本次进展。
- 如果 Pomodoist 不可用，仍更新 OpenSpec 实施清单，并在交付说明中明确哪些进度尚未同步；恢复后补到对应会话分组。不要把密钥、连接字符串或 TMDB 数据快照放进任务说明、规范或 Git。

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
