#!/usr/bin/env python3
"""Summarize nginx and backend logs for one day or one week.

Usage: see docs/guide/07_log_summary.md.

The script reads each log file line by line. It never loads a whole file.
It keeps only counters and short arrays of numbers. It calls no external service.
It never reads or writes a model file name, a model content, or a tensor name.
"""

from __future__ import annotations

import argparse
import gzip
import json
import re
import sys
from array import array
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

SURGERY_PATH = "/api/surgery"
TRACKED_STATUS = (400, 413, 429, 500, 504)
# Bucket labels as the backend writes them (apps/backend/app/metrics.py).
UPLOAD_BUCKETS = ("<1", "1-5", "5-10", "10-25", "25-50", ">=50", "unknown")
NODE_BUCKETS = ("<10", "10-49", "50-199", "200-999", ">=1000", "unknown")
OUTCOMES = ("ok", "rejected", "bad_zip", "too_large", "timeout", "failed", "abandoned")
# Outcomes of a request that held or asked for the semaphore.
WAITED = frozenset({"ok", "timeout", "failed", "abandoned"})

_TS_RE = re.compile(
    r"(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})(?:[.,]\d+)?(Z|[+-]\d{2}:?\d{2})?"
)
_KV_RE = re.compile(r"(\w+)=(\S+)")


def parse_iso(text: str) -> datetime | None:
    """Parse a timestamp. Return a UTC datetime. A timestamp without a zone is UTC."""
    match = _TS_RE.search(text)
    if not match:
        return None
    day, clock, zone = match.groups()
    value = datetime.fromisoformat(f"{day}T{clock}")
    if zone and zone != "Z":
        sign = 1 if zone[0] == "+" else -1
        digits = zone[1:].replace(":", "")
        offset = timedelta(hours=int(digits[:2]), minutes=int(digits[2:]))
        return (value - sign * offset).replace(tzinfo=timezone.utc)
    return value.replace(tzinfo=timezone.utc)


def open_text(path: str):
    if path == "-":
        return sys.stdin
    if path.endswith(".gz"):
        return gzip.open(path, "rt", encoding="utf-8", errors="replace")
    return open(path, "rt", encoding="utf-8", errors="replace")


def to_float(value) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if number >= 0 else None


def percentile(values, fraction: float) -> float:
    """Nearest-rank percentile. The caller must pass a non-empty sequence."""
    ordered = sorted(values)
    rank = max(1, -(-int(round(fraction * 100 * len(ordered))) // 100))
    return ordered[min(rank, len(ordered)) - 1]


def stats(values) -> dict | None:
    if not len(values):
        return None
    return {
        "count": len(values),
        "avg": round(sum(values) / len(values), 3),
        "p95": round(percentile(values, 0.95), 3),
        "max": round(max(values), 3),
    }


def ordered_counts(counts: dict, known) -> dict:
    """Known labels first, in their fixed order. Unknown labels follow."""
    result = {label: counts.get(label, 0) for label in known}
    result.update({k: v for k, v in sorted(counts.items()) if k not in result})
    return result


class Summary:
    def __init__(self, start: datetime, end: datetime):
        self.start = start
        self.end = end
        self.requests = 0
        self.uploads = 0
        self.status = {code: 0 for code in TRACKED_STATUS}
        self.surgery_total = 0
        self.outcomes: dict[str, int] = {}
        self.upload_buckets: dict[str, int] = {}
        self.node_buckets: dict[str, int] = {}
        self.durations = array("d")
        self.waits = array("d")
        self.max_queue = 0
        self.skipped = {"nginx": 0, "backend": 0}
        self.containers = []

    def in_range(self, moment: datetime | None) -> bool:
        return moment is not None and self.start <= moment < self.end

    def add_nginx(self, line: str) -> None:
        line = line.strip()
        if not line:
            return
        try:
            row = json.loads(line)
            moment = parse_iso(str(row.get("time", row.get("time_iso8601", ""))))
            code = int(row["status"])
        except (ValueError, KeyError, TypeError, AttributeError):
            self.skipped["nginx"] += 1
            return
        if not self.in_range(moment):
            return
        method = str(row.get("method", row.get("request_method", ""))).upper()
        path = str(row.get("uri", row.get("path", ""))).split("?", 1)[0]
        if path.rstrip("/") != SURGERY_PATH or method != "POST":
            return
        self.requests += 1
        if code in self.status:
            self.status[code] += 1
        if code == 200:
            self.uploads += 1

    def add_backend(self, line: str) -> None:
        if "event=surgery" not in line:
            return
        fields = dict(_KV_RE.findall(line))
        moment = parse_iso(fields.get("ts", "")) or parse_iso(line)
        if moment is None:
            self.skipped["backend"] += 1
            return
        if not self.in_range(moment):
            return
        self.surgery_total += 1
        outcome = fields.get("outcome", "unknown")
        self.outcomes[outcome] = self.outcomes.get(outcome, 0) + 1
        for key, counts in (
            ("upload_mb_bucket", self.upload_buckets),
            ("node_count_bucket", self.node_buckets),
        ):
            label = fields.get(key, "unknown")
            counts[label] = counts.get(label, 0) + 1
        surgery = to_float(fields.get("surgery_ms"))
        if outcome == "ok" and surgery is not None:
            self.durations.append(surgery / 1000)
        wait = to_float(fields.get("queue_wait_ms"))
        if outcome in WAITED and wait is not None:
            self.waits.append(wait / 1000)
        depth = to_float(fields.get("queue_depth_on_arrival"))
        if depth is not None:
            self.max_queue = max(self.max_queue, int(depth))

    def add_inspect(self, text: str) -> None:
        data = json.loads(text)
        if isinstance(data, dict):
            data = [data]
        for item in data:
            state = item.get("State", {})
            self.containers.append(
                {
                    "name": str(item.get("Name", "")).lstrip("/"),
                    "status": state.get("Status"),
                    "restarts": int(item.get("RestartCount", 0)),
                    "oom_killed": bool(state.get("OOMKilled", False)),
                    "started_at": state.get("StartedAt"),
                }
            )

    def failure_rates(self) -> dict:
        total = self.requests
        return {
            str(code): round(count / total, 4) if total else 0.0
            for code, count in self.status.items()
        }

    def as_dict(self) -> dict:
        return {
            "period": {
                "start": self.start.isoformat(),
                "end": self.end.isoformat(),
            },
            "requests": self.requests,
            "uploads": self.uploads,
            "upload_mb_buckets": ordered_counts(self.upload_buckets, UPLOAD_BUCKETS),
            "node_count_buckets": ordered_counts(self.node_buckets, NODE_BUCKETS),
            "surgery_log_count": self.surgery_total,
            "outcomes": ordered_counts(self.outcomes, OUTCOMES),
            "surgery_seconds": stats(self.durations),
            "wait_seconds": stats(self.waits),
            "max_queue_depth": self.max_queue,
            "status_counts": {str(c): n for c, n in self.status.items()},
            "failure_rates": self.failure_rates(),
            "containers": self.containers,
            "skipped_lines": self.skipped,
        }


def fmt_stats(block, unit="s") -> str:
    if not block:
        return "no data"
    return f"avg {block['avg']:.1f}{unit}, p95 {block['p95']:.1f}{unit}, max {block['max']:.1f}{unit}"


def render_markdown(summary: Summary, label: str) -> str:
    data = summary.as_dict()
    total_failed = sum(summary.status.values())
    restarts = sum(c["restarts"] for c in summary.containers)
    oom = sum(1 for c in summary.containers if c["oom_killed"])
    lines = [
        f"# StringLights {label}",
        "",
        f"- Uploads: {data['uploads']} of {data['requests']} requests",
        f"- Failures: {total_failed} (" + ", ".join(
            f"{c} x{n}" for c, n in summary.status.items() if n
        ) + ")" if total_failed else "- Failures: 0",
        f"- Surgery (ok): {fmt_stats(data['surgery_seconds'])}",
        f"- Wait: {fmt_stats(data['wait_seconds'])}, max queue {data['max_queue_depth']}",
        (
            f"- Containers: {restarts} restarts, {oom} OOM"
            if summary.containers
            else "- Containers: no docker inspect input"
        ),
        "",
        "## Details",
        "",
        "Backend outcomes (" + str(data["surgery_log_count"]) + " lines):",
        "",
    ]
    lines += [f"- {k}: {v}" for k, v in data["outcomes"].items() if v]
    lines += ["", "Upload size (MB), from backend buckets:", ""]
    lines += [f"- {k}: {v}" for k, v in data["upload_mb_buckets"].items() if v]
    lines += ["", "Node count, from backend buckets:", ""]
    lines += [f"- {k}: {v}" for k, v in data["node_count_buckets"].items() if v]
    lines += ["", "Failure rate per surgery request:", ""]
    lines += [
        f"- {c}: {n} ({data['failure_rates'][c] * 100:.1f}%)"
        for c, n in data["status_counts"].items()
    ]
    if summary.containers:
        lines += ["", "Containers (totals since creation):", ""]
        lines += [
            f"- {c['name']}: {c['status']}, restarts {c['restarts']}, OOM {'yes' if c['oom_killed'] else 'no'}"
            for c in summary.containers
        ]
    if any(summary.skipped.values()):
        lines += ["", f"Skipped lines: {summary.skipped}"]
    return "\n".join(lines) + "\n"


def build_period(period: str, day: date | None) -> tuple[datetime, datetime, str]:
    last = day or (datetime.now(timezone.utc).date() - timedelta(days=1))
    first = last if period == "day" else last - timedelta(days=6)
    start = datetime(first.year, first.month, first.day, tzinfo=timezone.utc)
    end = datetime(last.year, last.month, last.day, tzinfo=timezone.utc) + timedelta(days=1)
    label = f"{first} (day)" if period == "day" else f"{first}..{last} (week)"
    return start, end, label


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--nginx", nargs="*", default=[], help="nginx JSON log files ('-' is stdin)")
    parser.add_argument("--backend", nargs="*", default=[], help="backend log files")
    parser.add_argument("--inspect", nargs="*", default=[], help="docker inspect JSON files")
    parser.add_argument("--period", choices=("day", "week"), default="day")
    parser.add_argument("--date", type=date.fromisoformat, help="last day, UTC, YYYY-MM-DD (default: yesterday)")
    parser.add_argument("--format", choices=("markdown", "json", "both"), default="markdown")
    parser.add_argument("--out-dir", help="write summary.md and summary.json here")
    args = parser.parse_args(argv)

    start, end, label = build_period(args.period, args.date)
    summary = Summary(start, end)
    for path in args.nginx:
        with open_text(path) as handle:
            for line in handle:
                summary.add_nginx(line)
    for path in args.backend:
        with open_text(path) as handle:
            for line in handle:
                summary.add_backend(line)
    for path in args.inspect:
        with open_text(path) as handle:
            summary.add_inspect(handle.read())

    markdown = render_markdown(summary, label)
    as_json = json.dumps(summary.as_dict(), indent=2) + "\n"
    if args.out_dir:
        out = Path(args.out_dir)
        out.mkdir(parents=True, exist_ok=True)
        (out / "summary.md").write_text(markdown, encoding="utf-8")
        (out / "summary.json").write_text(as_json, encoding="utf-8")
    if args.format in ("markdown", "both"):
        sys.stdout.write(markdown)
    if args.format in ("json", "both"):
        sys.stdout.write(as_json)
    return 0


if __name__ == "__main__":
    sys.exit(main())
