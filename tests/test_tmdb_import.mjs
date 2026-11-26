import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { importQueries, readSnapshot } from '../scripts/tmdb_import.mjs';

const row = {
  tmdb_id: 100, locale: 'zh-CN', title: '测试片名', original_title: 'Synthetic title',
  overview: '测试简介', poster_path: null, release_date: '2026-01-01', genre_ids: [12, 18],
  fetched_at: '2026-02-01T01:02:03.123456+00:00',
};

function fixture(t, records = [row], candidates = [100]) {
  const dir = mkdtempSync(join(tmpdir(), 'cine-relay-import-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ locale: 'zh-CN', candidates: candidates.map((id) => ({ id })) }));
  writeFileSync(join(dir, 'movies.jsonl'), records.map((r) => JSON.stringify(r)).join('\n') + '\n');
  return dir;
}

test('accepts a complete snapshot and preserves its original timestamps', (t) => {
  assert.deepEqual(readSnapshot(fixture(t)), [row]);
});

test('rejects missing, duplicate, out-of-manifest and invalid records', (t) => {
  assert.throws(() => readSnapshot(fixture(t, [row], [100, 200])), /还缺 1/);
  assert.throws(() => readSnapshot(fixture(t, [row, row])), /ID 重复/);
  assert.throws(() => readSnapshot(fixture(t, [row], [200])), /不在片单中/);
  assert.throws(() => readSnapshot(fixture(t, [row], [100, 100])), /片单含无效或重复 ID/);
  assert.throws(() => readSnapshot(fixture(t, [{ ...row, fetched_at: '2026-02-30T00:00:00Z' }])), /无效字段/);
  assert.throws(() => readSnapshot(fixture(t, [{ ...row, locale: 'en-US' }])), /语言不匹配/);
});

test('Postgres transaction: idempotency, timestamp ordering, retention, tombstones and rollback', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  const migration = readFileSync(new URL('../db/migrations/0001_initial.sql', import.meta.url), 'utf8');
  await db.exec(migration);
  function apply(rows) {
    return db.transaction(async (tx) => {
      const summaries = [];
      for (const { text, params } of importQueries(rows)) summaries.push((await tx.query(text, params)).rows[0]);
      return summaries;
    });
  }
  const summary = (n, removed = 0) => [{ written: n }, { written: n, removed }];
  assert.deepEqual(await apply([row]), summary(1));
  assert.deepEqual(await apply([row]), summary(0));
  const newer = { ...row, title: '新标题', original_title: 'New', fetched_at: '2026-02-01T01:02:03.123457+00:00' };
  assert.deepEqual(await apply([newer]), summary(1));
  assert.deepEqual(await apply([row]), summary(0));
  const result = await db.query(`SELECT original_title, title, genre_ids,
    extract(epoch FROM expires_at - fetched_at)::int AS ttl,
    extract(epoch FROM purge_after - fetched_at)::int AS retention
    FROM public.movies JOIN public.movie_localizations USING (tmdb_id)`);
  assert.deepEqual(result.rows, [{ original_title: 'New', title: '新标题', genre_ids: [12, 18], ttl: 604800, retention: 2592000 }]);
  await db.exec('UPDATE public.movies SET removed_at = now() WHERE tmdb_id = 100');
  assert.deepEqual(await apply([{ ...row, fetched_at: '2026-03-01T00:00:00Z' }]), summary(0, 1));
  await assert.rejects(apply([{ ...row, tmdb_id: 200, locale: 'invalid' }]), { code: '23514' });
  assert.equal((await db.query('SELECT count(*)::int AS count FROM public.movies')).rows[0].count, 1);
});
