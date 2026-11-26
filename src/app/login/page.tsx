import Link from 'next/link';
import { ArrowRight, FileCheck, LockKeyhole, ShieldCheck } from 'lucide-react';
import { BrandMark, GitHubMark } from '@/components/brand';
import { DemoButton } from '@/components/static-controls';
import { Badge } from '@/components/ui/badge';
export default function Login(){return <div className="login-scene"><div className="login-stack"><section className="login-approved-card">
 <div className="login-brand-row"><div className="wordmark"><BrandMark/>CineRelay</div><Badge variant="outline"><LockKeyhole aria-hidden="true"/>仅受邀管理员</Badge></div>
 <h1>登录管理控制台</h1><p className="login-intro">仅 GitHub 账户 ID 在管理员白名单中的受邀成员可进入。不开放公开注册，外部 API Key 无法访问后台。</p>
 <DemoButton primary wide message="静态演示 · 尚未接入 GitHub OAuth。"><GitHubMark/>使用 GitHub 受邀账户登录</DemoButton>
 <ul className="login-security"><li><ShieldCheck aria-hidden="true"/><span><b>白名单校验</b> · 默认拒绝未受邀账户</span></li><li><FileCheck aria-hidden="true"/><span><b>敏感变更</b> · 自动写入只读操作审计</span></li></ul>
 <div className="login-docs"><Link className="text-link" href="/docs/api">查看公开 API 文档<ArrowRight aria-hidden="true"/></Link><code>/docs/api</code></div>
 </section><p className="login-session"><LockKeyhole aria-hidden="true"/>Auth.js 服务端会话保护 · 待接入</p></div></div>}
