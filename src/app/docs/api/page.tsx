import { Callout, DemoStrip, PageHead, Panel } from "@/components/console";
import { Badge } from "@/components/ui/badge";
import { DemoButton } from "@/components/static-controls";
import { Input } from "@/components/ui/input";
export default function ApiDocs(){return <div className="page-flow"><PageHead title="CineRelay API" sub="Scalar 公开文档结构 · v1 · 外部契约概念"/><DemoStrip>Scalar 风格预览 · 尚未接入真实 OpenAPI 或请求调试</DemoStrip>
 <div className="split"><Panel title="获取单部电影详情"><div className="in-card-stack"><div className="flex flex-wrap items-center gap-2"><Badge variant="success">GET</Badge><code className="endpoint">/api/v1/movies/&#123;tmdbId&#125;</code></div><label className="control-label">路径参数 · tmdbId<Input readOnly value="920101"/></label><label className="control-label">查询参数 · lang<Input readOnly value="zh-CN"/></label><Callout>调用真实接口需要由 VidAll 服务端保存的 Bearer Token。</Callout><DemoButton>试用接口</DemoButton></div></Panel>
 <Panel title="200 · 示例响应"><pre className="code-block"><code>{JSON.stringify({tmdbId:920101,locale:"zh-CN",title:"海街晨光",cache:"hit"},null,2)}</code></pre><p className="mt-3 text-sm text-muted-foreground">401 未认证 · 503 暂不可用</p></Panel></div></div>}
