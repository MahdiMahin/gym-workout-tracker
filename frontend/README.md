# Gym Workout Tracker — Frontend

React 19 + TypeScript + Vite 7 + Tailwind CSS 4. The current UI is a **demo** with editable workout records stored in the browser's localStorage. It does not read/write production Supabase data.

## Run locally

Requires Node.js 20.19+ or 22.12+.

```bash
cd frontend
npm install
npm run dev
```

Open the localhost URL shown by Vite (usually http://localhost:5173).

## Quality checks

```bash
npm run lint
npm run test
npm run build
```

## Supabase handoff

Copy `.env.example` to `.env.local` and supply the project URL and **publishable** key after the backend team finalizes table schemas and Row Level Security. The client is prepared in `src/lib/supabase.ts`, but this demo intentionally does not send writes to Supabase. Do **not** expose service-role/secret keys in the browser or commit credentials.

## Pages

- Dashboard — statistics and recent workouts
- Workouts — add a demo workout with exercises, sets, reps, and weight
- History — review workouts and delete demo entries
- Progress — volume trend and personal record summaries
- Profile — demo profile and project status

Demo data is seeded the first time the app opens. The Reset demo action restores those records. Data entered in the browser is not shared with other users.

## Team workflow

Use feature branches, open pull requests to `main`, request teammate reviews, and link each PR and Jira task in the sprint report. No automated production deployment is enabled by this frontend PR.
