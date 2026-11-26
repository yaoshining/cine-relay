import Link from "next/link";
import { BrandMark,GitHubMark } from "@/components/brand";
import { Callout,Panel } from "@/components/console";
import { DemoButton } from "@/components/static-controls";
export default function Login(){return <div className="login-wrap"><div className="login-card"><Panel title={<h1 className="wordmark"><BrandMark/>登录 CineRelay</h1>} sub="仅受邀管理员可进入后台。"><div className="in-card-stack"><Callout>1.1 视觉骨架 · GitHub OAuth 将在 1.3 接入。</Callout><DemoButton><GitHubMark/>使用 GitHub 登录</DemoButton><div className="flex flex-wrap gap-4"><Link href="/" className="text-link">返回静态演示</Link><Link href="/docs/api" className="text-link">查看公开 API 文档</Link></div></div></Panel></div></div>}
