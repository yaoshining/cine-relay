## ADDED Requirements

### Requirement: 日常变更默认进入固定预览分支

日常功能与修复 PR SHALL 默认以 `staging` 为目标分支；`staging` SHALL 用于 Vercel Preview 验收。正式发布 SHALL 在验收通过并获明确授权后通过 `main` 进行，不以生产部署代替预览。

#### Scenario: 合入日常 PR

- **WHEN** 日常 PR 合入 `staging`
- **THEN** Vercel 创建目标为 Preview 的部署，并在成功后用同一分支地址访问新版；`main` 保持不变

#### Scenario: 固定预览登录入口

- **WHEN** `staging` 的新版本完成部署
- **THEN** 管理员仍在固定分支地址登录，OAuth 回调不随单次部署的 URL 变化；预览不复用生产的会话秘密或数据库

#### Scenario: 生产通过 EdgeOne 访问

- **WHEN** 生产通过 `https://cine-relay.vidall.top` 提供服务
- **THEN** EdgeOne 通过 HTTPS 回源至 `cine-relay.vercel.app` 的稳定生产部署；GitHub OAuth 发起和回调均使用公开域名，受保护响应不得共享缓存；会话和准入审计仍必须通过原有校验

#### Scenario: EdgeOne 回源主机与浏览器来源不同

- **WHEN** 正式域名的登录 Server Action 经 EdgeOne 到达 Vercel，回源主机与浏览器来源不同
- **THEN** 只为精确公开主机允许该代理差异，其他不匹配来源仍被拒绝，GitHub OAuth 回跳仍使用正式域名
