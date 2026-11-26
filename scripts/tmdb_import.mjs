import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { neon } from '@neondatabase/serverless';

const target = { project: 'dawn-morning-29374960', branch: 'main', database: 'cine_relay' };
const validId = (id) => Number.isSafeInteger(id) && id > 0;
const validText = (s) => typeof s === 'string' && !s.includes('\0');
const validDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)
  && !s.startsWith('0000-') && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;

function readSnapshotFile(directory, name) {
  try { return readFileSync(join(directory, name), 'utf8'); }
  catch { throw new Error(`无法读取 ${name}，请检查快照目录`); }
}

function parseJson(text, label) {
  try { return JSON.parse(text); }
  catch { throw new Error(`${label} 不是有效的 JSON`); }
}

export function readSnapshot(directory) {
  const manifest = parseJson(readSnapshotFile(directory, 'manifest.json'), 'manifest.json');
  if (manifest?.locale !== 'zh-CN' || !Array.isArray(manifest.candidates) || !manifest.candidates.length) {
    throw new Error('片单为空或语言不是 zh-CN');
  }
  const pending = new Set();
  for (const candidate of manifest.candidates) {
    if (!validId(candidate?.id) || pending.has(candidate.id)) throw new Error('片单含无效或重复 ID');
    pending.add(candidate.id);
  }
  const lines = readSnapshotFile(directory, 'movies.jsonl').trimEnd().split(/\r?\n/);
  const rows = lines.map((line, index) => {
    const label = `movies.jsonl 第 ${index + 1} 行`;
    const row = parseJson(line, label);
    if (!validId(row?.tmdb_id) || !pending.delete(row.tmdb_id) || row.locale !== manifest.locale) {
      throw new Error(`${label} 的 ID 重复、不在片单中，或语言不匹配`);
    }
    const { tmdb_id, locale, title, original_title, overview, poster_path, release_date, genre_ids, fetched_at } = row;
    if (!validText(title) || !title.trim() || ![original_title, overview, poster_path].every((s) => s === null || validText(s))
      || (release_date !== null && !validDate(release_date))
      || !Array.isArray(genre_ids) || !genre_ids.every((id) => validId(id) && id <= 2147483647)
      || typeof fetched_at !== 'string' || !validDate(fetched_at.slice(0, 10))
      || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|\+00:00)$/.test(fetched_at)
      || !Number.isFinite(Date.parse(fetched_at))) {
      throw new Error(`${label} 含无效字段`);
    }
    return { tmdb_id, locale, title, original_title, overview, poster_path, release_date, genre_ids, fetched_at };
  });
  if (pending.size) throw new Error(`快照还缺 ${pending.size} 部电影，请先完成抓取`);
  return rows;
}

export function importQueries(rows) {
  return [
    {
      text: `WITH written AS (
        INSERT INTO public.movies AS m (tmdb_id, original_title, release_date, genre_ids, updated_at)
        SELECT tmdb_id, original_title, release_date, genre_ids, fetched_at
        FROM jsonb_to_recordset($1::jsonb) AS s(tmdb_id bigint, original_title text, release_date date,
          genre_ids integer[], fetched_at timestamptz)
        ORDER BY tmdb_id
        ON CONFLICT (tmdb_id) DO UPDATE SET original_title = EXCLUDED.original_title,
          release_date = EXCLUDED.release_date, genre_ids = EXCLUDED.genre_ids, updated_at = EXCLUDED.updated_at
        WHERE m.removed_at IS NULL AND EXCLUDED.updated_at > m.updated_at
        RETURNING 1
      ) SELECT count(*)::int AS written FROM written`,
      params: [JSON.stringify(rows.map(({ tmdb_id, original_title, release_date, genre_ids, fetched_at }) =>
        ({ tmdb_id, original_title, release_date, genre_ids, fetched_at })))],
    },
    {
      text: `WITH source AS (
        SELECT s.*, m.removed_at
        FROM jsonb_to_recordset($1::jsonb) AS s(tmdb_id bigint, locale text, title text,
          overview text, poster_path text, fetched_at timestamptz)
        JOIN public.movies m USING (tmdb_id)
      ), written AS (
        INSERT INTO public.movie_localizations AS ml (tmdb_id, locale, title, overview, poster_path,
          fetched_at, expires_at, purge_after)
        SELECT tmdb_id, locale, title, overview, poster_path, fetched_at,
          fetched_at + interval '168 hours', fetched_at + interval '720 hours'
        FROM source WHERE removed_at IS NULL
        ORDER BY tmdb_id, locale
        ON CONFLICT (tmdb_id, locale) DO UPDATE SET title = EXCLUDED.title,
          overview = EXCLUDED.overview, poster_path = EXCLUDED.poster_path, fetched_at = EXCLUDED.fetched_at,
          expires_at = EXCLUDED.expires_at, purge_after = EXCLUDED.purge_after
        WHERE EXCLUDED.fetched_at > ml.fetched_at
        RETURNING 1
      ) SELECT (SELECT count(*)::int FROM written) AS written,
        (SELECT count(*)::int FROM source WHERE removed_at IS NOT NULL) AS removed`,
      params: [JSON.stringify(rows.map(({ tmdb_id, locale, title, overview, poster_path, fetched_at }) =>
        ({ tmdb_id, locale, title, overview, poster_path, fetched_at })))],
    },
  ];
}

function connectionString() {
  const result = spawnSync('neon', ['connection-string', target.branch, '--project-id', target.project,
    '--database-name', target.database], { encoding: 'utf8', timeout: 45_000, stdio: ['ignore', 'pipe', 'pipe'] });
  if (result.status === 0) {
    const value = result.stdout.trim();
    try {
      const url = new URL(value);
      if (['postgresql:', 'postgres:'].includes(url.protocol) && url.hostname.endsWith('.neon.tech')
          && url.pathname === `/${target.database}` && url.password) return value;
    } catch { /* Never print the CLI output or the connection string. */ }
  }
  throw new Error('无法通过 Neon CLI 获取指定数据库的连接，请确认已安装 neon、已登录且有项目访问权限');
}

async function main() {
  const { values } = parseArgs({ options: {
    'input-dir': { type: 'string', default: '.tmdb-prefetch' },
    'dry-run': { type: 'boolean' }, help: { type: 'boolean', short: 'h' },
  } });
  if (values.help) {
    console.log('用法：npm run import:tmdb -- [--dry-run] [--input-dir .tmdb-prefetch]');
    return;
  }
  const rows = readSnapshot(values['input-dir']);
  console.log(`[校验] ${rows.length} 部 zh-CN 电影，片单与详情一致`);
  if (values['dry-run']) {
    console.log('[预检] 只检查了本地快照，未连接 Neon');
    return;
  }
  const sql = neon(connectionString(), { fetchOptions: { signal: AbortSignal.timeout(90_000) } });
  console.log(`[导入] ${target.project} / ${target.branch} / ${target.database}，正在提交事务…`);
  let results;
  try {
    results = await sql.transaction(importQueries(rows).map(({ text, params }) => sql.query(text, params)));
  } catch (err) {
    const code = typeof err?.code === 'string' && /^[0-9A-Z]{5}$/.test(err.code) ? `（SQLSTATE ${err.code}）` : '';
    throw new Error(`Neon 未确认导入${code}；请检查网络及数据库迁移状态，同一快照可以安全重跑`);
  }
  const [[movies], [localizations]] = results;
  const skipped = rows.length - localizations.written - localizations.removed;
  console.log(`[完成] 电影主表写入 ${movies.written} 条；中文详情写入 ${localizations.written} 条，跳过 ${skipped} 条较旧或相同记录，跳过 ${localizations.removed} 条已下架记录`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(`[停止] ${err instanceof Error ? err.message : '导入失败'}`);
    process.exitCode = 1;
  });
}
