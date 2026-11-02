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
    # Same field order and types as the log_format in build/nginx/nginx.conf.
    return (
        f'{{"time":"{time}","ip_anon":"203.0.113.0","method":"{method}","uri":"{uri}",'
        f'"status":{status},"request_length":{size},"bytes_sent":512,"request_time":0.250,'
        f'"upstream_response_time":"0.240","ua":"Mozilla/5.0","referer":""}}'
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


def backend(ts, outcome, status, upload="1-5", depth=0, wait=0, surgery=0, nodes="10-49"):
    # Same layout as SurgeryLog.emit in apps/backend/app/metrics.py.
    return (
        f"event=surgery ts={ts} outcome={outcome} status={status} upload_mb_bucket={upload} "
        f"queue_depth_on_arrival={depth} queue_wait_ms={wait} surgery_ms={surgery} "
        f"total_ms={wait + surgery} node_count_bucket={nodes}"
    )


BACKEND = [
    backend("2026-11-02T10:00:05Z", "ok", 200, "1-5", 1, 0, 2000, "10-49"),
    backend("2026-11-02T11:00:09Z", "ok", 200, "25-50", 3, 1500, 8000, "200-999"),
    backend("2026-11-02T14:00:30Z", "timeout", 504, "5-10", 2, 500, 60000, "50-199"),
    backend("2026-11-02T13:00:01Z", "bad_zip", 400, "<1", 0, 0, 0, "unknown"),
    "INFO:     10.0.0.1 - \"POST /api/surgery HTTP/1.1\" 200 OK",
    backend("2026-11-03T00:00:00Z", "ok", 200, "1-5", 9, 0, 1),
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

    def test_bucket_distribution(self):
        data = build().as_dict()
        self.assertEqual(
            data["upload_mb_buckets"],
            {"<1": 1, "1-5": 1, "5-10": 1, "10-25": 0, "25-50": 1, ">=50": 0, "unknown": 0},
        )
        self.assertEqual(data["node_count_buckets"]["200-999"], 1)
        self.assertEqual(data["node_count_buckets"]["unknown"], 1)

    def test_outcomes(self):
        data = build().as_dict()
        self.assertEqual(data["surgery_log_count"], 4)
        self.assertEqual(data["outcomes"]["ok"], 2)
        self.assertEqual(data["outcomes"]["timeout"], 1)
        self.assertEqual(data["outcomes"]["bad_zip"], 1)

    def test_surgery_time_and_queue(self):
        data = build().as_dict()
        # Only outcome=ok counts for surgery time.
        self.assertEqual(data["surgery_seconds"]["count"], 2)
        self.assertEqual(data["surgery_seconds"]["avg"], 5.0)
        # bad_zip never waited, so it stays out of the wait stats.
        self.assertEqual(data["wait_seconds"]["count"], 3)
        self.assertEqual(data["wait_seconds"]["max"], 1.5)
        self.assertEqual(data["max_queue_depth"], 3)

    def test_unknown_outcome_and_bucket_are_kept(self):
        start, end, _ = ls.build_period("day", date(2026, 11, 2))
        summary = ls.Summary(start, end)
        summary.add_backend(backend("2026-11-02T10:00:00Z", "weird", 200, "999"))
        data = summary.as_dict()
        self.assertEqual(data["outcomes"]["weird"], 1)
        self.assertEqual(data["upload_mb_buckets"]["999"], 1)

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
