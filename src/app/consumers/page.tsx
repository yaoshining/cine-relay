import { DemoStrip,PageHead } from "@/components/console";
import { ConsumersPanel } from "@/components/consumer-table";
import { DemoButton } from "@/components/static-controls";
export default function Consumers(){return <div className="page-flow"><PageHead title="外部应用" sub="管理服务到服务的 API 访问权限。" action={<DemoButton primary message="静态演示 · 未签发凭据。">签发新凭据</DemoButton>}/><DemoStrip>合成数据 · 不签发或展示真实密钥</DemoStrip><ConsumersPanel/></div>}
