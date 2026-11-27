import { FileCheck, LockKeyhole, ShieldCheck } from "lucide-react";
import { BrandMark, GitHubMark } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function LoginView({ enabled, error, signIn }: {
  enabled: boolean;
  error?: string;
  signIn: () => Promise<void>;
}) {
  const message = !enabled
    ? "GitHub 登录尚未配置。请联系部署管理员。"
    : error === "AccessDenied"
      ? "无法授权此 GitHub 账户。请确认使用的是受邀账户，或联系管理员。"
      : error ? "暂时无法完成登录。请重试，或联系管理员。" : null;

  return <main id="content" className="login-scene"><div className="login-stack"><section className="login-approved-card">
    <div className="login-brand-row"><div className="wordmark"><BrandMark/>CineRelay</div><Badge variant="outline"><LockKeyhole aria-hidden="true"/>仅受邀管理员</Badge></div>
    <h1>登录管理控制台</h1>
    <p className="login-intro">仅 GitHub 账户 ID 在管理员白名单中的受邀成员可进入。不开放公开注册，外部 API Key 无法访问后台。</p>
    {message && <p role="status" className="mb-3 text-sm text-muted-foreground">{message}</p>}
    <form action={signIn}>
      <Button className="min-h-11 w-full" type="submit" disabled={!enabled}><GitHubMark/>使用 GitHub 受邀账户登录</Button>
    </form>
    <ul className="login-security">
      <li><ShieldCheck aria-hidden="true"/><span><b>白名单校验</b> · 默认拒绝未受邀账户</span></li>
      <li><FileCheck aria-hidden="true"/><span><b>准入审计</b> · 登录判定写入操作审计</span></li>
    </ul>
  </section><p className="login-session"><LockKeyhole aria-hidden="true"/>Auth.js 服务端会话保护</p></div></main>;
}
