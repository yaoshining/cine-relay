#!/usr/bin/env bash
# Fetch only the dedicated TMDB token from a personal Bitwarden vault.
set +x
set +a
set -euo pipefail

usage() {
    printf '用法：bash scripts/tmdb_prefetch_bw.sh <Bitwarden 条目 UUID> [抓取参数…]\n'
}

case "${1-}" in
    -h|--help) usage; exit 0 ;;
    '') usage >&2; exit 2 ;;
esac
item_id=$1
shift
if [[ ! $item_id =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$ ]]; then
    printf '请传入专用 TMDB 条目的 UUID，而不是条目名称或 Token。\n' >&2
    exit 2
fi
for command_name in bw python3; do
    if ! command -v "$command_name" >/dev/null; then
        printf '找不到命令：%s\n' "$command_name" >&2
        exit 1
    fi
done
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)

if ! bw login --check --quiet >/dev/null 2>&1; then
    printf 'Bitwarden CLI 尚未登录；请先在终端运行 bw login --raw >/dev/null。\n' >&2
    exit 1
fi

if [[ -z ${BW_SESSION:-} ]]; then
    if [[ ! -t 0 ]]; then
        printf '请在交互式终端运行本脚本以解锁 Bitwarden。\n' >&2
        exit 1
    fi
    printf '请在 Bitwarden CLI 提示时输入主密码。\n' >&2
    if ! BW_SESSION=$(bw unlock --raw) || [[ -z $BW_SESSION ]]; then
        printf 'Bitwarden 解锁失败。\n' >&2
        exit 1
    fi
    export BW_SESSION
fi

unset TMDB_READ_TOKEN
if ! TMDB_READ_TOKEN=$(
    bw get item "$item_id" --raw | python3 -c '
import json, re, sys

try:
    item = json.load(sys.stdin)
except (ValueError, UnicodeError):
    sys.exit(1)

if item.get("type") == 1:
    token = (item.get("login") or {}).get("password")
    if not isinstance(token, str) or not re.fullmatch(r"[^\s\x00-\x1f\x7f]+", token):
        sys.exit(1)
elif item.get("type") == 2:
    values = [item.get("notes")] + [f.get("value") for f in item.get("fields") or []]
    candidates = {
        token for value in values if isinstance(value, str)
        for token in re.findall(r"\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b", value)
    }
    if len(candidates) != 1:
        sys.exit(1)
    token = candidates.pop()
else:
    sys.exit(1)
print(token)
'
); then
    printf '无法读取有效的 Token。请检查登录条目的密码字段，或确认安全笔记正文和自定义字段中只有一个 Read Access Token。\n' >&2
    exit 1
fi

# The fetcher needs the TMDB token, never the Bitwarden vault session.
unset BW_SESSION
export TMDB_READ_TOKEN
exec python3 "$script_dir/tmdb_prefetch.py" "$@"
