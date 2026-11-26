import argparse
import contextlib
import io
import json
import tempfile
import unittest
from datetime import date
from pathlib import Path
from unittest.mock import Mock, patch
from urllib.error import HTTPError

from scripts import tmdb_prefetch as prefetch


class PrefetchTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.out = Path(directory.name)
        env_patch = patch.dict("os.environ", {"TMDB_READ_TOKEN": "synthetic-token"})
        client_patch = patch.object(prefetch, "TMDB")
        env_patch.start()
        self.addCleanup(env_patch.stop)
        self.tmdb = client_patch.start().return_value
        self.addCleanup(client_patch.stop)
        self.tmdb.get.side_effect = self.fake_response

    def fake_response(self, path, **params):
        self.assertEqual(params["language"], "zh-CN")
        if path == "/discover/movie":
            self.assertEqual(params["primary_release_date.gte"], "2025-11-26")
            self.assertEqual(params["primary_release_date.lte"], "2026-11-25")
            ids = {1: [11, 12], 2: [12, 13]}[params["page"]]
            return {"total_pages": 2, "results": [{"id": id_, "title": f"样片 {id_}"} for id_ in ids]}
        id_ = int(path.rsplit("/", 1)[-1])
        return {"id": id_, "title": f"样片 {id_}", "original_title": "Fixture", "overview": "合成简介",
                "release_date": "2026-01-01", "genres": [{"id": 7}], "poster_path": None}

    def run_prefetch(self, **options):
        args = argparse.Namespace(**{"output_dir": self.out, "start_date": date(2025, 11, 26),
                                     "end_date": date(2026, 11, 25), "limit": 3,
                                     "list_only": False, "verbose": False, **options})
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            status = prefetch.run(args)
        return status, output.getvalue()

    def test_preview_freezes_paginated_deduplicated_list(self):
        self.assertEqual(self.run_prefetch(list_only=True)[0], 0)
        self.assertFalse((self.out / "movies.jsonl").exists())
        manifest = json.loads((self.out / "manifest.json").read_text())
        self.assertEqual([row["id"] for row in manifest["candidates"]], [11, 12, 13])
        self.assertEqual([call.args[0] for call in self.tmdb.get.call_args_list], ["/discover/movie"] * 2)
        with self.assertRaisesRegex(ValueError, "不同条件"):
            self.run_prefetch(limit=1)
        self.tmdb.get.reset_mock()
        status, output = self.run_prefetch(verbose=True)
        self.assertEqual(status, 0)
        self.assertIn("本次新增 3", output)
        self.assertIn('"overview": "合成简介"', output)
        self.assertEqual([call.args[0] for call in self.tmdb.get.call_args_list],
                         ["/movie/11", "/movie/12", "/movie/13"])

    def test_resume_skips_successes_and_repairs_partial_tail(self):
        def initial_fetch(path, **params):
            if path == "/movie/12":
                raise prefetch.FetchError("HTTP 503")
            return self.fake_response(path, **params)

        self.tmdb.get.side_effect = initial_fetch
        self.assertEqual(self.run_prefetch()[0], 1)
        with (self.out / "movies.jsonl").open("ab") as file:
            file.write(b'{"tmdb_id":')
        self.tmdb.get.side_effect = self.fake_response
        self.tmdb.get.reset_mock()
        status, output = self.run_prefetch()
        self.assertEqual(status, 0)
        self.assertIn("末尾半行", output)
        self.assertIn("本次新增 1，跳过 2", output)
        self.assertEqual([call.args[0] for call in self.tmdb.get.call_args_list], ["/movie/12"])
        rows = [json.loads(line) for line in (self.out / "movies.jsonl").read_text().splitlines()]
        self.assertEqual({row["tmdb_id"] for row in rows}, {11, 12, 13})
        self.assertEqual(len(rows), 3)
        self.assertTrue(all(row["locale"] == "zh-CN" and row["fetched_at"].endswith("+00:00") for row in rows))


class TMDBClientTests(unittest.TestCase):
    def test_throttle_honors_retry_after_then_succeeds(self):
        throttled = HTTPError(prefetch.BASE_URL, 429, "", {"Retry-After": "3"}, io.BytesIO())
        with patch.object(prefetch, "urlopen", side_effect=[throttled, io.BytesIO(b'{"id":11}')]) as request, \
                patch.object(prefetch.time, "sleep") as sleep, patch.object(prefetch, "log"):
            result = prefetch.TMDB("synthetic-token").get("/movie/11", language="zh-CN")
        self.assertEqual(result, {"id": 11})
        self.assertEqual(request.call_count, 2)
        sleep.assert_called_once_with(3)

    def test_unauthorized_stops_without_retries(self):
        denied = HTTPError(prefetch.BASE_URL, 401, "", {}, io.BytesIO())
        wait = Mock()
        with patch.object(prefetch, "urlopen", side_effect=denied), patch.object(prefetch.time, "sleep", wait):
            with self.assertRaises(prefetch.FetchError) as ctx:
                prefetch.TMDB("synthetic-token").get("/movie/11", language="zh-CN")
        self.assertTrue(ctx.exception.fatal)
        wait.assert_not_called()
