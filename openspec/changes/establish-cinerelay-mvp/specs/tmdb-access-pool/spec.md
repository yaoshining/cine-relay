## ADDED Requirements

### Requirement: 凭据管理与共享预算

系统 SHALL 支持多个 TMDB 凭据的启停和健康状态展示。凭据在服务端加密保存、不回显；任务和 API 回源共享并发预算与冷却状态。

#### Scenario: 管理员查看凭据

- **WHEN** 管理员打开凭据列表
- **THEN** 系统展示可用状态、最近错误和冷却信息，不返回 Token 原文

#### Scenario: 上游限流

- **WHEN** TMDB 返回 429
- **THEN** 系统尊重可用的 Retry-After 并在共享范围内退避，不换凭据绕过限流
