#!/usr/bin/env python3
"""Build a fixed TMDB discovery manifest and fetch localized details to JSONL."""

import argparse
import json
import os
import sys
import tempfile
import time
from datetime import date, datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from http.client import HTTPException
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

BASE_URL = "https://api.themoviedb.org/3"
MAX_PAGES = 500


class FetchError(Exception):
    def __init__(self, message, *, fatal=False):
        super().__init__(message)
        self.fatal = fatal


def log(message):
    print(message, flush=True)


def safe_text(text):
    return "".join(ch if ch.isprintable() else " " for ch in str(text))


def retry_delay(value):
    if value is None:
        return None
    if value.isascii() and value.isdecimal():
        return int(value)
    try:
        return max(0, (parsedate_to_datetime(value) - datetime.now(timezone.utc)).total_seconds())
    except (ValueError, TypeError, OverflowError):
        return None


class TMDB:
    def __init__(self, token, attempts=4):
        self.token = token
        self.attempts = attempts

    def get(self, path, **params):
        request = Request(f"{BASE_URL}{path}?{urlencode(params)}", headers={"Accept": "application/json"})
        request.add_unredirected_header("Authorization", f"Bearer {self.token}")
        for attempt in range(1, self.attempts + 1):
            hinted = None
            try:
                with urlopen(request, timeout=20) as response:
                    result = json.load(response)
                if not isinstance(result, dict):
                    raise FetchError(f"{path}：响应不是 JSON 对象", fatal=True)
                return result
            except HTTPError as error:
                code = error.code
                reason = f"HTTP {code}"
                hinted = retry_delay(error.headers.get("Retry-After"))
                error.close()
                if code not in (408, 429) and not 500 <= code <= 599:
                    raise FetchError(f"{path}：{reason}", fatal=code != 404) from None
                # Stop the whole run after persistent throttling; do not hammer the next ID.
                fatal = code == 429
            except (URLError, TimeoutError, HTTPException):
                reason, fatal = "网络错误或超时", False
            except (ValueError, UnicodeError):
                raise FetchError(f"{path}：无效的 JSON 响应", fatal=True) from None
            if attempt == self.attempts:
                raise FetchError(f"{path}：{reason}，已尝试 {attempt} 次", fatal=fatal)
            delay = max(2 ** (attempt - 1), hinted or 0)
            if delay > 120:
                raise FetchError(f"{path}：{reason}，服务端要求等待 {delay:g} 秒；请稍后续跑", fatal=True)
            log(f"  重试 {attempt}/{self.attempts - 1} {path}：{reason}，{delay:g} 秒后再试")
            time.sleep(delay)


def discover(client, start, end, limit):
    candidates = {}
    for page in range(1, MAX_PAGES + 1):
        response = client.get("/discover/movie", **{
            "primary_release_date.gte": start, "primary_release_date.lte": end,
            "language": "zh-CN", "include_adult": "false", "sort_by": "popularity.desc", "page": page,
        })
        rows, pages = response.get("results"), response.get("total_pages")
        if not isinstance(rows, list) or type(pages) is not int or pages < 0:
            raise FetchError("TMDB 返回了无效的 Discover 分页结果", fatal=True)
        for row in rows:
            if not isinstance(row, dict) or type(row.get("id")) is not int or row["id"] <= 0:
                raise FetchError("TMDB 返回了无效的电影 ID", fatal=True)
            candidates.setdefault(row["id"], {key: row.get(key) for key in ("id", "title", "release_date")})
            if len(candidates) == limit:
                break
        log(f"[选片] 第 {page}/{min(pages, MAX_PAGES) or 1} 页，已选 {len(candidates)}/{limit} 部")
        if len(candidates) == limit or page >= pages:
            break
    else:
        log(f"[选片] 达到 {MAX_PAGES} 页上限；只保存已取得的 {len(candidates)} 部")
    return list(candidates.values())


def atomic_json(path, value):
    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent, delete=False) as tmp:
        temp_path = Path(tmp.name)
        try:
            json.dump(value, tmp, ensure_ascii=False, indent=2)
            tmp.write("\n")
            tmp.flush()
            os.replace(temp_path, path)
        finally:
            temp_path.unlink(missing_ok=True)


def previous_year(day):
    return day.replace(year=day.year - 1, day=28 if (day.month, day.day) == (2, 29) else day.day)


def existing_records(file, candidate_ids):
    done = set()
    file.seek(0)
    line_no = 0
    while True:
        offset = file.tell()
        line = file.readline()
        if not line:
            return done
        if not line.endswith(b"\n"):
            file.truncate(offset)
            log("[续跑] 已丢弃上次中断留下的末尾半行")
            return done
        line_no += 1
        try:
            record = json.loads(line)
            tmdb_id = record["tmdb_id"]
            if type(tmdb_id) is not int or tmdb_id not in candidate_ids or tmdb_id in done or record["locale"] != "zh-CN":
                raise ValueError
        except (ValueError, TypeError, KeyError):
            raise ValueError(f"movies.jsonl 第 {line_no} 行损坏或与片单不匹配；请检查文件或换目录") from None
        done.add(tmdb_id)


def normalize(detail, tmdb_id):
    def optional_text(key):
        value = detail.get(key)
        return (value.strip() or None) if isinstance(value, str) else None

    title = optional_text("title") or optional_text("original_title")
    if type(detail.get("id")) is not int or detail["id"] != tmdb_id or title is None:
        raise FetchError(f"/movie/{tmdb_id}：详情 ID 不匹配或缺少标题")
    release = optional_text("release_date")
    if release:
        try:
            release = date.fromisoformat(release).isoformat()
        except ValueError:
            raise FetchError(f"/movie/{tmdb_id}：上映日期无效") from None
    genres = detail.get("genres")
    if not isinstance(genres, list) or any(
        not isinstance(genre, dict) or type(genre.get("id")) is not int or genre["id"] <= 0
        for genre in genres
    ):
        raise FetchError(f"/movie/{tmdb_id}：类型列表无效")
    return {
        "tmdb_id": tmdb_id, "locale": "zh-CN", "title": title,
        "original_title": optional_text("original_title"), "overview": optional_text("overview"),
        "release_date": release, "genre_ids": list(dict.fromkeys(genre["id"] for genre in genres)),
        "poster_path": optional_text("poster_path"), "fetched_at": datetime.now(timezone.utc).isoformat(),
    }


def run(args):
    directory = args.output_dir
    manifest_path = directory / "manifest.json"
    details_path = directory / "movies.jsonl"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else None
    if manifest is None and details_path.exists():
        raise ValueError("发现 movies.jsonl 但没有片单；请恢复 manifest.json 或使用新目录")

    def client():
        token = os.environ.get("TMDB_READ_TOKEN", "").strip()
        if not token:
            raise FetchError("请先设置 TMDB_READ_TOKEN（TMDB 的 API Read Access Token）", fatal=True)
        return TMDB(token)

    if manifest is None:
        end = args.end_date or datetime.now(timezone.utc).date()
        start = args.start_date or (previous_year(end) + timedelta(days=1))
        limit = args.limit if args.limit is not None else 500
        if start > end:
            raise ValueError("开始日期不能晚于结束日期")
        tmdb = client()
        directory.mkdir(mode=0o700, parents=True, exist_ok=True)
        log(f"[选片] {start} 至 {end}（含首尾），按热度取前 {limit} 部，语言 zh-CN")
        candidates = discover(tmdb, start.isoformat(), end.isoformat(), limit)
        manifest = {"start_date": start.isoformat(), "end_date": end.isoformat(),
                    "limit": limit, "locale": "zh-CN", "candidates": candidates}
        atomic_json(manifest_path, manifest)
        log(f"[选片] 已固定 {len(candidates)} 部：{manifest_path}")
    else:
        for key, provided in (("start_date", args.start_date), ("end_date", args.end_date), ("limit", args.limit)):
            val = provided.isoformat() if isinstance(provided, date) else provided
            if val is not None and val != manifest[key]:
                raise ValueError("当前目录已有不同条件的片单；改变日期或数量时请使用新目录")
        candidates = manifest["candidates"]
        log(f"[选片] 复用本地片单：{len(candidates)} 部（{manifest['start_date']} 至 {manifest['end_date']}）")

    if args.list_only:
        for idx, movie in enumerate(candidates, 1):
            log(f"[{idx:03}/{len(candidates)}] ID={movie['id']} {safe_text(movie['title'] or '未提供片名')} | {safe_text(movie['release_date'] or '未提供日期')}")
        return 0
    if not candidates:
        log("[汇总] 片单为空，未请求详情或写入详情文件")
        return 0
    added, failed, skipped = 0, [], 0
    fd = os.open(details_path, os.O_RDWR | os.O_CREAT | os.O_APPEND, 0o600)
    with os.fdopen(fd, "a+b") as file:
        done = existing_records(file, {row["id"] for row in candidates})
        log(f"[续跑] 已保存 {len(done)}/{len(candidates)} 部")
        tmdb = client() if len(done) < len(candidates) else None
        try:
            for idx, movie in enumerate(candidates, 1):
                tmdb_id = movie["id"]
                if tmdb_id in done:
                    skipped += 1
                    continue
                log(f"[{idx:03}/{len(candidates)}] 抓取 ID={tmdb_id} {safe_text(movie['title'] or '未提供片名')}")
                try:
                    record = normalize(tmdb.get(f"/movie/{tmdb_id}", language="zh-CN"), tmdb_id)
                except FetchError as error:
                    failed.append(tmdb_id)
                    log(f"  失败：{error}")
                    if error.fatal:
                        break
                    continue
                file.write((json.dumps(record, ensure_ascii=False) + "\n").encode("utf-8"))
                file.flush()
                done.add(tmdb_id)
                added += 1
                log(f"  已保存 {len(done)}/{len(candidates)}：{safe_text(record['title'])} | "
                    f"上映 {record['release_date'] or '未知'} | 类型 {record['genre_ids']} | "
                    f"简介 {len(record['overview'] or '')} 字符 | 海报{'有' if record['poster_path'] else '无'}")
                if args.verbose:
                    log(json.dumps(record, ensure_ascii=False, indent=2))
        finally:
            log(f"[汇总] 本次新增 {added}，跳过 {skipped}，失败 {len(failed)}；"
                f"累计 {len(done)}/{len(candidates)}，剩余 {len(candidates) - len(done)} 部")
            if failed:
                log(f"[汇总] 失败 ID（重跑原命令会再尝试）：{', '.join(map(str, failed))}")
            log(f"[本地输出] {details_path}")
    return 1 if failed else 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, default=Path(".tmdb-prefetch"))
    parser.add_argument("--start-date", type=date.fromisoformat, metavar="YYYY-MM-DD")
    parser.add_argument("--end-date", type=date.fromisoformat, metavar="YYYY-MM-DD")
    parser.add_argument("--limit", type=int, help="新片单默认 500；复用片单时保持原值")
    parser.add_argument("--list-only", action="store_true", help="只固定并打印片单，不抓详情")
    parser.add_argument("--verbose", action="store_true", help="打印每部新抓电影完整的已保存字段")
    args = parser.parse_args()
    if args.limit is not None and not 1 <= args.limit <= 10000:
        parser.error("--limit 必须在 1 到 10000 之间")
    try:
        return run(args)
    except (FetchError, OSError, ValueError, KeyError, TypeError) as error:
        print(f"[停止] {error}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("[停止] 已中断；可以用同一目录重跑。", file=sys.stderr)
        return 130


if __name__ == "__main__":
    sys.exit(main())
