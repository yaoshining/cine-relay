## ADDED Requirements

### Requirement: 日常变更默认进入固定预览分支

日常功能与修复 PR SHALL 默认以 `staging` 为目标分支；`staging` SHALL 用于 Vercel Preview 验收。正式发布 SHALL 在验收通过并获明确授权后通过 `main` 进行，不以生产部署代替预览。

#### Scenario: 合入日常 PR

- **WHEN** 日常 PR 合入 `staging`
- **THEN** Vercel 创建目标为 Preview 的部署，并在成功后用同一分支地址访问新版；`main` 保持不变

#### Scenario: 固定预览登录入口

- **WHEN** `staging` 的新版本完成部署
- **THEN** 管理员仍在固定分支地址登录，OAuth 回调不随单次部署的 URL 变化；预览不复用生产的会话秘密或数据库
