import Link from "next/link";
import { Callout, PageHead } from "@/components/console";
export default function NotFound(){return <div className="page-flow"><PageHead title="未找到此页面"/><Callout>这个地址或记录不存在。</Callout><Link href="/" className="text-link">返回运营总览</Link></div>}
