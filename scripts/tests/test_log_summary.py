import io
import json
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import log_summary as ls  # noqa: E402

MB = 1024 * 1024


def nginx(time, status, size=MB, uri="/api/surgery", method="POST"):
    return json.dumps(
        {"time": time, "status": status, "method": method, "uri": uri, "request_length": size}
    )


NGINX = [
    nginx("2026-11-02T10:00:00+00:00", 200, 2 * MB),
    nginx("2026-11-02T11:00:00+00:00", 200, 30 * MB),
    nginx("2026-11-02T12:00:00+09:00", 400, 100),  # 03:00 UTC, same day
    nginx("2026-11-02T13:00:00+00:00", 413, 60 * MB),
    nginx("2026-11-02T14:00:00+00:00", 504, 5 * MB),
    nginx("2026-11-02T15:00:00+00:00", 200, 1, uri="/api/health", method="GET"),
    nginx("2026-11-01T23:59:59+00:00", 200, MB),  # previous day
    "not json",
]
BACKEND = [
    "2026-11-02 10:00:05,123 INFO event=surgery status=ok duration_ms=2000 wait_ms=0 queue_depth=1",
    "2026-11-02T11:00:09Z event=surgery status=ok duration_ms=8000 wait_ms=1500 queue_depth=3",
    "2026-11-02T14:00:30Z event=surgery status=timeout duration_ms=60000 wait_ms=500 queue_depth=2",
    "2026-11-02T14:00:31Z other line",
    "2026-11-03T00:00:00Z event=surgery status=ok duration_ms=1 wait_ms=0 queue_depth=9",
]
INSPECT = [
    {"Name": "/string_lights_backend", "RestartCount": 2,
     "State": {"Status": "running", "OOMKilled": True, "StartedAt": "x"}},
    {"Name": "/string_lights_nginx", "RestartCount": 0,
     "State": {"Status": "running", "OOMKilled": False, "StartedAt": "x"}},
]


def build(period="day", day=date(2026, 11, 2)):
    start, end, _ = ls.build_period(period, day)
    summary = ls.Summary(start, end)
    for line in NGINX:
        summary.add_nginx(line)
    for line in BACKEND:
        summary.add_backend(line)
    summary.add_inspect(json.dumps(INSPECT))
    return summary


class SummaryTest(unittest.TestCase):
    def test_counts_and_rates(self):
        data = build().as_dict()
        self.assertEqual(data["requests"], 5)
        self.assertEqual(data["uploads"], 2)
        self.assertEqual(data["status_counts"]["400"], 1)
        self.assertEqual(data["status_counts"]["413"], 1)
        self.assertEqual(data["status_counts"]["504"], 1)
        self.assertEqual(data["failure_rates"]["400"], 0.2)
        self.assertEqual(data["skipped_lines"]["nginx"], 1)

    def test_size_distribution(self):
        data = build().as_dict()
        self.assertEqual(data["upload_size_buckets"]["<1MB"], 1)
        self.assertEqual(data["upload_size_buckets"][">=50MB"], 1)
        self.assertEqual(data["upload_size_bytes"]["max"], 60 * MB)

    def test_surgery_time_and_queue(self):
        data = build().as_dict()
        self.assertEqual(data["surgery_log_count"], 3)
        self.assertEqual(data["surgery_log_failed"], 1)
        self.assertEqual(data["surgery_seconds"]["avg"], round(70 / 3, 3))
        self.assertEqual(data["surgery_seconds"]["max"], 60)
        self.assertEqual(data["wait_seconds"]["max"], 1.5)
        self.assertEqual(data["max_queue_depth"], 3)

    def test_week_includes_previous_day(self):
        data = build("week").as_dict()
        self.assertEqual(data["requests"], 6)

    def test_containers(self):
        text = ls.render_markdown(build(), "x")
        self.assertIn("2 restarts, 1 OOM", text)

    def test_percentile(self):
        self.assertEqual(ls.percentile(range(1, 101), 0.95), 95)
        self.assertEqual(ls.percentile([7], 0.95), 7)

    def test_markdown_starts_with_five_lines(self):
        lines = ls.render_markdown(build(), "x").splitlines()
        self.assertTrue(all(l.startswith("- ") for l in lines[2:7]))
        self.assertEqual(lines[7], "")

    def test_empty_input(self):
        start, end, _ = ls.build_period("day", date(2026, 11, 2))
        text = ls.render_markdown(ls.Summary(start, end), "x")
        self.assertIn("Uploads: 0 of 0", text)
        self.assertIn("no data", text)

    def test_cli_writes_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            n, b, i = (Path(tmp) / x for x in ("n.log", "b.log", "i.json"))
            n.write_text("\n".join(NGINX))
            b.write_text("\n".join(BACKEND))
            i.write_text(json.dumps(INSPECT))
            out = Path(tmp) / "out"
            with redirect_stdout(io.StringIO()):
                ls.main(["--nginx", str(n), "--backend", str(b), "--inspect", str(i),
                         "--date", "2026-11-02", "--out-dir", str(out)])
            self.assertEqual(json.loads((out / "summary.json").read_text())["uploads"], 2)
            self.assertTrue((out / "summary.md").exists())

    def test_no_names_in_output(self):
        row = json.loads(NGINX[0])
        row["uri"] = "/api/surgery?name=secret_model.onnx"
        start, end, _ = ls.build_period("day", date(2026, 11, 2))
        summary = ls.Summary(start, end)
        summary.add_nginx(json.dumps(row))
        self.assertNotIn("secret", json.dumps(summary.as_dict()))


if __name__ == "__main__":
    unittest.main()
