## ADDED Requirements

### Requirement: 受邀管理员访问

系统 SHALL 只向受邀管理员提供后台会话，并在服务端保护所有后台页面和管理 API；系统不提供公开注册。

#### Scenario: 受邀账户登录

- **WHEN** 通过 GitHub OAuth 登录的账户 ID 在管理员白名单中
- **THEN** 系统允许该账户访问后台

#### Scenario: 未受邀或持外部密钥访问

- **WHEN** 未受邀账户或仅持 VidAll API Key 的调用方尝试访问后台
- **THEN** 系统拒绝访问且不返回管理数据

### Requirement: 只读电影浏览与审计

系统 SHALL 支持按 TMDB ID 或片名查询缓存，并按语言和缓存状态筛选；详情展示抓取时间、过期时间和下架状态。系统 SHALL 记录凭据变更、任务重跑和外部密钥撤销等关键动作，不记录秘密。

#### Scenario: 查询已缓存的电影

- **WHEN** 管理员按已缓存电影的 TMDB ID 查询
- **THEN** 后台展示数据库记录和其缓存状态，不触发 TMDB 回源

#### Scenario: 变更敏感配置

- **WHEN** 管理员撤销外部应用凭据
- **THEN** 审计记录包含操作者、时间、动作和结果，不包含密钥
