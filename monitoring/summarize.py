#!/usr/bin/env python3
"""Summarize API heartbeat results against our SLOs, for sprint reports.

Usage:
    git fetch origin metrics
    git show origin/metrics:metrics/heartbeat.csv > /tmp/heartbeat.csv
    python3 monitoring/summarize.py /tmp/heartbeat.csv --since 2026-11-24 --until 2026-12-07

Prints a Markdown summary: availability, latency percentiles per check,
SLO status, schedule gaps and every failure.
"""
import argparse
import csv
import math
import statistics
import sys
from collections import defaultdict
from datetime import date, datetime, time, timedelta, timezone


def parse_ts(value):
    return datetime.strptime(value, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)


def percentile(values, p):
    """Nearest-rank percentile of a non-empty list."""
    ordered = sorted(values)
    rank = max(1, math.ceil(p / 100 * len(ordered)))
    return ordered[rank - 1]


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("csv_path")
    parser.add_argument("--since", type=date.fromisoformat, help="first day to include (UTC), YYYY-MM-DD")
    parser.add_argument("--until", type=date.fromisoformat, help="last day to include (UTC), YYYY-MM-DD")
    parser.add_argument("--slo-availability", type=float, default=99.5, help="availability SLO in %% (default 99.5)")
    parser.add_argument("--slo-p95-ms", type=float, default=500, help="p95 latency SLO in ms (default 500)")
    parser.add_argument("--interval-min", type=float, default=15, help="scheduled minutes between runs (default 15)")
    args = parser.parse_args()

    start = datetime.combine(args.since, time.min, timezone.utc) if args.since else None
    end = datetime.combine(args.until + timedelta(days=1), time.min, timezone.utc) if args.until else None

    runs = defaultdict(list)  # (timestamp, run_id) -> rows
    with open(args.csv_path, newline="") as f:
        for row in csv.DictReader(f):
            ts = parse_ts(row["timestamp_utc"])
            if (start and ts < start) or (end and ts >= end):
                continue
            runs[(ts, row["run_id"])].append(row)

    if not runs:
        sys.exit("No heartbeat rows in that range.")

    keys = sorted(runs)
    first, last = keys[0][0], keys[-1][0]
    up_runs = sum(all(r["ok"] == "true" for r in runs[k]) for k in keys)
    availability = 100 * up_runs / len(keys)

    window_start, window_end = start or first, end or last
    expected = (window_end - window_start).total_seconds() / 60 / args.interval_min
    gaps = [(b[0] - a[0]).total_seconds() / 60 for a, b in zip(keys, keys[1:])]

    checks = defaultdict(lambda: {"total": 0, "ok": 0, "latencies": []})
    failures = []
    for k in keys:
        for r in runs[k]:
            c = checks[r["check"]]
            c["total"] += 1
            if r["ok"] == "true":
                c["ok"] += 1
                c["latencies"].append(int(r["latency_ms"]))
            else:
                failures.append(r)

    label = f"{window_start:%Y-%m-%d} to {(window_end - timedelta(seconds=1)):%Y-%m-%d}"
    print(f"## API heartbeat: {label}\n")
    line = f"- Runs: {len(keys):,}"
    if expected >= 1:
        line += f" (about {expected:,.0f} scheduled at one every {args.interval_min:g} min)"
    if gaps:
        line += f"; median gap {statistics.median(gaps):.0f} min, longest {max(gaps):.0f} min"
    print(line)
    met = "met" if availability >= args.slo_availability else "MISSED"
    print(f"- Availability (runs where every check passed): {availability:.2f}% "
          f"({up_runs:,}/{len(keys):,}); SLO {args.slo_availability:g}%: {met}\n")

    print(f"| Check | Runs | Success | p50 (ms) | p95 (ms) | Max (ms) | p95 SLO {args.slo_p95_ms:g} ms |")
    print("|---|---|---|---|---|---|---|")
    for name in sorted(checks):
        c = checks[name]
        success = f"{100 * c['ok'] / c['total']:.2f}%"
        if c["latencies"]:
            p50, p95, peak = percentile(c["latencies"], 50), percentile(c["latencies"], 95), max(c["latencies"])
            slo = "met" if p95 <= args.slo_p95_ms else "MISSED"
            print(f"| {name} | {c['total']:,} | {success} | {p50} | {p95} | {peak} | {slo} |")
        else:
            print(f"| {name} | {c['total']:,} | {success} | n/a | n/a | n/a | n/a |")

    print(f"\n### Failures ({len(failures)})\n")
    if failures:
        print("| Time (UTC) | Check | HTTP | Detail |")
        print("|---|---|---|---|")
        for r in failures:
            print(f"| {r['timestamp_utc']} | {r['check']} | {r['http_status'] or '-'} | {r['detail'] or '-'} |")
    else:
        print("None.")
    print(f"\nFirst run {first:%Y-%m-%d %H:%M} UTC, last run {last:%Y-%m-%d %H:%M} UTC. "
          "Latency is measured from GitHub's runners, so it includes network time.")


if __name__ == "__main__":
    main()
