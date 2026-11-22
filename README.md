[![Frontend CI](https://github.com/MahdiMahin/gym-workout-tracker/actions/workflows/frontend-ci.yml/badge.svg)](https://github.com/MahdiMahin/gym-workout-tracker/actions/workflows/frontend-ci.yml)
[![Supabase CI](https://github.com/MahdiMahin/gym-workout-tracker/actions/workflows/supabase-ci.yml/badge.svg)](https://github.com/MahdiMahin/gym-workout-tracker/actions/workflows/supabase-ci.yml)

# Gym Workout Tracker

A project for planning and tracking gym workouts. The application and its
features are not implemented yet; this README is a starting point to fill in as
the project takes shape.

## Status

🚧 In development

## Planned features

- Create and manage workout routines
- Record exercises, sets, reps, and weights
- Review workout history and progress

## Prerequisites

- **Node.js:** 22
- **Package manager:** npm
- **Docker and Supabase CLI:** required to run the local database and database tests

## Getting started

### Setup

From the repository root, install the frontend dependencies:

```bash
cd frontend
npm ci
```

### Run locally

From `frontend/`, start the development server:

```bash
npm run dev
```

To start the local Supabase services, run `supabase start` from the repository root.

## Tests

Run frontend tests from `frontend/`:

```bash
npm run test
```

Run database tests from the repository root:

```bash
supabase test db
```

## Project structure

Document the main directories and files here as the codebase grows.

- `supabase/` — backend: database migrations, Row Level Security, pgTAP tests and
  local Supabase config. See [supabase/README.md](supabase/README.md).
- `.github/workflows/supabase-ci.yml` — applies migrations to a fresh database and
  runs the database tests on every PR that touches `supabase/`.

## Configuration

Copy the example environment file:

```bash
cp frontend/.env.example frontend/.env.local
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` as needed. Never
commit secrets, service-role keys, or database passwords.

## Contributing

Contributions are welcome. Please open an issue to discuss a significant change
before submitting a pull request. Add project-specific development, formatting,
and pull request guidelines here as they are established.

## License

TODO: Choose a license and link to the license file when one is added.
