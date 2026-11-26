import Link from 'next/link';
import { Activity, ArrowRight, Info, LockKeyhole, Plus, Terminal } from 'lucide-react';
import { DemoStrip, HitChart, PageHead, Panel } from '@/components/console';
import { DemoTable } from '@/components/demo-table';
import { DemoButton } from '@/components/static-controls';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const apps=[
 ['VidAll 服务端生产','vidall-prod-8k2m',true,'1 分钟前 · 14,610 次','2026-11-25'],
 ['VidAll 预发布环境','vidall-stg-4p9x',true,'26 分钟前 · 210 次','2026-11-24'],
 ['VidAll 轮换旧凭据','vidall-old-3x9p',false,'昨日 18:16 · 0 次','2026-10-18'],
] as const;
export default function Consumers(){return <div className="page-flow">
 <PageHead title="外部应用" sub="管理服务端调用凭据与缓存优先契约 · 外部密钥仅存哈希，不可进入管理后台" action={<><Button variant="outline" asChild><Link href="/docs/api">查看 /docs/api 文档<ArrowRight/></Link></Button><DemoButton primary message="静态演示 · 未签发凭据。"><Plus/>签发应用凭据</DemoButton></>}/>
 <DemoStrip>合成调用统计 · 不签发或展示真实密钥</DemoStrip>
 <div className="consumer-bento"><Panel title={<><Activity className="heading-icon"/>VidAll 外部 API 调用与缓存概览</>}>
  <div className="consumer-stats"><div><small>24h 调用</small><strong>14,820</strong></div><div><small>缓存命中率</small><strong className="fresh">98.4%</strong></div><div><small>陈旧期兜底</small><strong className="expired">12 <span>· 0.08%</span></strong></div></div>
  <HitChart compact/><div className="chart-axis mono">{['00:00','06:00','12:00','18:00','24:00'].map(x=><span key={x}>{x}</span>)}</div>
  <div className="tag-row"><Badge variant="outline"><LockKeyhole/>仅服务端 Bearer 鉴权</Badge><Badge variant="success">有效命中不回源 TMDB</Badge><Badge variant="outline">30 天保留期兜底</Badge></div>
 </Panel><Panel title={<><Terminal className="heading-icon"/>服务端接入示例</>}>
  <code className="endpoint"><b className="fresh">GET</b> /api/v1/movies/&#123;tmdbId&#125;?lang=zh-CN</code>
  <pre className="code-block consumer-code"><code><span className="text-muted-foreground"># 请求头 · 示例脱敏</span>{'\n'}Authorization: Bearer <span className="json-key">cr_live_••••</span>{'\n\n'}<span className="text-muted-foreground"># 200 · 响应节选</span>{'\n{\n  '}<span className="json-key">&quot;cache&quot;</span>: <span className="fresh">&quot;hit&quot;</span>{',\n  '}<span className="json-key">&quot;stale&quot;</span>: <span className="expired">false</span>{'\n}'}</code></pre>
 </Panel></div>
 <Panel title="外部应用凭据" action={<span className="fixture-meta">3 条记录 · 2 条有效</span>} className="fixture-table"><div className="fixture-scroll" tabIndex={0} role="region" aria-label="应用凭据表格"><DemoTable label="外部应用凭据" columns={['应用名称','凭据 ID / 前缀','权限范围','状态','最近调用 / 24h 次数','签发日期','操作']} rows={apps.map(([name,id,active,calls,date])=>[<b key="name">{name}</b>,<code key="id">{id}</code>,<Badge key="scope" variant="outline">电影详情 · 只读</Badge>,<Badge key="state" variant={active?'success':'danger'}>{active?'有效':'已撤销'}</Badge>,calls,<code key="date">{date}</code>,active?<DemoButton key="revoke" size="xs" danger message="静态演示 · 未撤销凭据。">撤销<span className="sr-only"> {name}</span></DemoButton>:'—'])}/></div><div className="fixture-table-footer"><span><Info aria-hidden="true"/>明文密钥仅在签发时展示一次；服务端仅存哈希。撤销生效后记入审计日志。</span></div></Panel>
 </div>;}
