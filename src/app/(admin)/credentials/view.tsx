import { PageHead, Callout, Panel } from "@/components/console";
import { DemoTable } from "@/components/demo-table";
import { AddTmdbCredential, ToggleTmdbCredential } from "@/components/tmdb-credential-forms";
import { getDb } from "@/lib/db/client";
import { readTmdbPool } from "@/lib/db/tmdb-credentials";
import { parsePoolKey } from "@/lib/tmdb/credential-crypto";

const errors = {
  unauthorized: "上游拒绝 · 已隔离", credential_unreadable: "解密失败 · 已隔离", rate_limited: "上游限流",
  not_found: "上游未找到", timeout: "上游超时", upstream_error: "上游错误", invalid_response: "上游响应无效",
};

export default async function Credentials() {
  let pool;
  try {
    pool = await readTmdbPool(getDb());
  } catch {
    pool = null;
  }
  const configured = !!parsePoolKey(process.env.TMDB_KEY_ENCRYPTION_KEY);
  return <div className="page-flow">
    <PageHead title="TMDB 凭据池" sub="试抓、正式同步与电影详情 API 共用预算和冷却。"/>
    {!pool ? <Callout warning>暂时无法读取凭据池，请检查数据库和迁移状态。</Callout> : <>
      <Panel title="共享请求预算">
        <p className="text-sm">{pool.gate?.request_count ?? 0} / 600 次（当前小时） · 最多 1 个并发上游请求</p>
        {pool.gate?.cooling && <Callout warning>共享冷却至 {pool.gate.cooldown_until}。冷却期间不会切换凭据继续请求。</Callout>}
      </Panel>
      <Panel title="添加加密凭据">
        {!configured && <p className="mb-3 text-sm text-muted-foreground">未配置有效的服务端加密密钥，暂不能添加凭据。</p>}
        <AddTmdbCredential configured={configured}/>
      </Panel>
      <Panel title="凭据与上游状态">
        {pool.keys.length ? <DemoTable label="TMDB 凭据" columns={["名称","开关状态","最近上游状态","最近检查","操作"]} rows={pool.keys.map((key) => [
          key.name, key.enabled ? "启用" : "停用", key.last_error ? errors[key.last_error] : key.last_checked_at ? "正常" : "尚未检查",
          key.last_checked_at ?? "—", <ToggleTmdbCredential key={key.id} id={key.id} enabled={key.enabled}/>,
        ])}/> : <p className="empty-panel">没有保存的 TMDB 凭据。</p>}
      </Panel>
    </>}
  </div>;
}
