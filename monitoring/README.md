# API heartbeat

A scheduled GitHub Actions workflow (`.github/workflows/heartbeat.yml`) that checks the live Supabase API every 15 minutes and records whether it worked and how long it took. It is how we measure backend availability and latency.

## What it checks

Each run signs in and reads data the same way the app does:

| Check | Request | Passes when |
|---|---|---|
| `auth` | `POST /auth/v1/token` as the heartbeat user | HTTP 200 and an access token is returned |
| `rest_exercises` | `GET /rest/v1/exercises?select=id` with that token | HTTP 200 and at least 15 rows (the seeded exercise library) |

The second check goes through the API gateway, PostgREST, row level security and Postgres, so a pass means the whole read path works. It has to sign in first: the `exercises` read policy only allows authenticated users, so an anonymous request returns 200 with an empty list and would look healthy even when nothing was read.

The heartbeat is read-only. It never writes workouts.

## SLIs and SLOs

| SLI | How it is measured | SLO |
|---|---|---|
| Availability | % of runs where every check passed | 99.5% per sprint |
| Latency | p95 of successful requests, per check | 500 ms |

At one run every 15 minutes a two-week sprint has about 1,340 runs, so 99.5% allows about 6 failed runs. Latency is measured from GitHub's runners, so it includes network time.

## Where the data lives

`metrics/heartbeat.csv` on the `metrics` branch, one row per check per run:

```
timestamp_utc,run_id,check,http_status,latency_ms,ok,detail
2026-11-19T14:22:03Z,123456789,auth,200,212,true,
2026-11-19T14:22:03Z,123456789,rest_exercises,200,148,true,rows=15
```

The branch is written only by the workflow, so it stays out of `main`'s history. Each run's results also appear on that run's page under Actions → API Heartbeat.

## Getting numbers for a report

```bash
git fetch origin metrics
git show origin/metrics:metrics/heartbeat.csv > /tmp/heartbeat.csv
python3 monitoring/summarize.py /tmp/heartbeat.csv --since 2026-11-24 --until 2026-12-07
```

It prints availability, p50/p95/max latency per check, whether each SLO was met, gaps in the schedule and every failure.

## When it fails (runbook)

A failed check fails the workflow run. GitHub emails the person who last changed the workflow's schedule, and the run shows a red X in the Actions tab.

1. Open the failed run and read the summary table: which check failed, the HTTP status and the detail.
2. Check https://status.supabase.com. If Supabase has an incident, note it in the team channel and wait.
3. Match the failure:
   - `auth` with `Invalid login credentials`: the heartbeat user's password or the `HEARTBEAT_*` secrets changed. Fix the secret.
   - `auth` with HTTP `000`: network error or timeout. One isolated failure is usually GitHub or network noise; several in a row is an outage.
   - `rest_exercises` with `rows=` below 15: the exercise seed data or the RLS policy on `exercises` changed. Check recent migrations.
   - `rest_exercises` with HTTP 401 or 403: the publishable key or RLS changed.
   - HTTP 5xx on either: Supabase or Postgres is unhealthy. Check the project's logs in the Supabase dashboard.
4. If the project is paused, restore it from the Supabase dashboard.
5. Record what happened and how long it lasted in the sprint report.

## Running it locally

```bash
export SUPABASE_URL=https://<project-ref>.supabase.co
export SUPABASE_KEY=<publishable key>
export HEARTBEAT_EMAIL=<heartbeat user email>
read -rs HEARTBEAT_PASSWORD && export HEARTBEAT_PASSWORD
bash monitoring/heartbeat.sh /tmp/heartbeat.csv; cat /tmp/heartbeat.csv
```

Needs `curl` and `jq`.

## Configuration

- Repository secrets: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `HEARTBEAT_EMAIL`, `HEARTBEAT_PASSWORD`.
- The heartbeat user is a normal Supabase Auth user with no workouts. Do not use a real person's account.
- GitHub may delay or skip scheduled runs when it is busy, so runs are about every 15 minutes, not exactly. GitHub also disables schedules in public repositories after 60 days with no activity.
