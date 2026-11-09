# Backend — Supabase

The backend uses a [Supabase](https://supabase.com) project for the Postgres database and authentication. Row Level Security (RLS) in the database decides what each user can read or write.

**Open decision:** the team has not yet chosen whether the frontend calls Supabase directly with `@supabase/supabase-js`, or goes through an Express API server that calls Supabase. This folder works for both. Either way, data access is enforced by RLS in the database (see [Security](#security)).

## Folder layout

```
supabase/
├── config.toml                 # Local stack settings (Supabase CLI)
├── migrations/                 # Every schema change, applied in filename order
│   └── 20261109000000_initial_schema.sql
├── tests/database/             # pgTAP tests, run with `supabase test db`
│   ├── 01_schema.test.sql      # tables, RLS enabled, views, functions, seed data
│   ├── 02_rls.test.sql         # users can only see their own data
│   └── 03_save_workout.test.sql# save_workout RPC + stats views
└── seed.sql                    # Local-only demo data (empty for now)
```

## Data model

```
auth.users ──1:1── profiles            (display name, lb/kg, theme)
     │
     ├──< workouts ──< workout_exercises ──< workout_sets
     │        │                │
     │        │                └──> exercises   (global library + user custom)
     │        └──> workout_templates ──< template_exercises ──> exercises
     ├──< body_measurements             (bodyweight log)
     └──< goals
```

| Table | Purpose | Frontend type (`frontend/src/data.ts`) |
|---|---|---|
| `profiles` | One row per user, created automatically on sign-up | — (Profile page) |
| `exercises` | Exercise library. `owner_id = null` is global; otherwise a user's custom exercise | `Exercise.name` |
| `workouts` | A logged session | `Workout` (`date` → `workout_date`, `duration` → `duration_minutes`) |
| `workout_exercises` | An exercise inside a workout, in order | `Exercise` |
| `workout_sets` | One set: reps, weight, warm-up flag, optional RPE | `ExerciseSet` |
| `workout_templates`, `template_exercises` | Saved routines (planned feature) | — |
| `body_measurements` | Bodyweight log, one per day (planned) | — |
| `goals` | Lift, frequency, bodyweight or volume goals (planned) | — |

**Views** (respect RLS through `security_invoker`):

- `workout_summaries`: one row per workout with `exercise_count`, `set_count`, `total_volume`. Same numbers as `workoutVolume()` / `workoutSetCount()` in the frontend; warm-up sets are excluded.
- `personal_records`: per user and exercise, `max_weight`, `best_set_volume`, `est_one_rep_max` (Epley).

**RPC**: `save_workout(payload jsonb)` saves a workout with all its exercises and sets in one transaction:

```ts
const { data: workoutId, error } = await supabase.rpc('save_workout', {
  payload: {
    name: 'Push Day', date: '2026-11-07', duration: 62, notes: 'Felt strong',
    exercises: [{ exercise_id: '<uuid>', sets: [{ reps: 8, weight: 135 }] }],
  },
})
```

## Security

- RLS is enabled on every table. Users can only read and write rows where `user_id = auth.uid()`; child tables (`workout_exercises`, `workout_sets`, `template_exercises`) check ownership through their parent.
- Everyone signed in can read the global exercise library; nobody can modify it from the app.
- RLS only applies when a request runs as the signed-in user:
  - **Frontend calling Supabase directly:** use the publishable key; supabase-js sends the user's session token automatically.
  - **Express server:** create a Supabase client per request with the publishable key and the user's access token from the `Authorization` header (`createClient(url, key, { global: { headers: { Authorization: req.headers.authorization } } })`). Do **not** use the service-role key for user requests; it bypasses RLS entirely.
- The service-role key and database password never go in the repo or the browser.

## Local development

Requires [Docker](https://docs.docker.com/get-docker/) and the Supabase CLI (`brew install supabase/tap/supabase`, or prefix commands with `npx supabase`).

```bash
supabase start        # starts local Postgres, Auth, REST API and Studio; applies migrations
supabase test db      # runs the pgTAP tests
supabase db reset     # wipes the local database and re-applies migrations + seed.sql
supabase stop
```

`supabase start` prints a local API URL and publishable key; put those in `frontend/.env.local` to point the frontend at your local stack.

## Making a schema change

1. `supabase migration new <short_description>` creates a timestamped file in `supabase/migrations/`.
2. Write the SQL, add or update tests in `supabase/tests/database/`.
3. `supabase db reset && supabase test db` locally.
4. Open a PR. The **Supabase CI** workflow applies all migrations to a fresh database, lints the schema and runs the tests.
5. Merge to `main`. The Supabase GitHub integration applies the new migration to the hosted project automatically (see below).

## Team rules for the hosted database

The dashboard's SQL Editor and Table Editor still work on the hosted project, but changes made there are **not recorded**: no migration file in the repo, no entry in the project's migration history. The live database then drifts from the repo, CI tests a schema that isn't the real one, and later migrations can fail to deploy (e.g. "relation already exists").

- **Data changes in the dashboard are fine:** adding or editing rows, running `select` queries.
- **Schema changes only go through a migration file in a PR:** `create`, `alter`, `drop`, RLS policies, functions, triggers, views.
- **To try out a schema change,** do it on your local stack (`supabase start`, Studio at http://localhost:54323), then turn it into a migration with `supabase db diff -f <name>`.
- **Every new table needs RLS enabled and policies** in the same migration. `01_schema.test.sql` fails if any table lacks RLS.

### If someone changed the hosted schema by hand

1. `supabase link --project-ref mdmcgcegnzfurryyjgwc`
2. `supabase db diff --linked` shows what differs from the migrations.
3. `supabase db pull` writes that difference into a new migration file.
4. `supabase migration repair --status applied <timestamp>` marks it as already applied, so the deploy doesn't run it again.
5. Commit the file in a PR like any other change.

## Deployment to the hosted project

The Supabase project (`mdmcgcegnzfurryyjgwc`) is connected to this repo through the **Supabase GitHub integration** with **Deploy to production** enabled on `main`. On every push or merge to `main`, Supabase:

- applies any new files in `supabase/migrations/` to the hosted database
- deploys Edge Functions and Storage buckets declared in `config.toml` (none yet)

Auth, API and seed settings in `config.toml` are **not** applied to the hosted project; they only affect the local stack. Hosted auth settings are changed in the dashboard.

So merging a PR is the deployment. Do not run `supabase db push` manually, and make sure **Supabase CI** is green before merging, since a merged migration goes straight to the live database. Check the deployment result in the dashboard under Project Settings → Integrations, or in the migration history (`supabase migration list` after `supabase link --project-ref mdmcgcegnzfurryyjgwc`).

## CI

`.github/workflows/supabase-ci.yml` runs on every PR or push to `main` that touches `supabase/**`:

1. `supabase db start`: fresh Postgres with all migrations applied
2. `supabase db lint --fail-on error`
3. `supabase test db`: pgTAP tests
