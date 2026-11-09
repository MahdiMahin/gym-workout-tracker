-- =====================================================================
-- REPLOG / Gym Workout Tracker — initial schema
-- Matches frontend/src/data.ts (Workout -> Exercise -> ExerciseSet)
-- plus tables for planned features (templates, bodyweight, goals).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. PROFILES (1:1 with auth.users)
-- ---------------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text check (char_length(display_name) <= 60),
  avatar_url    text,
  weight_unit   text not null default 'lb' check (weight_unit in ('lb','kg')),
  theme         text not null default 'dark' check (theme in ('dark','light')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Auto-create a profile row when a user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 2. EXERCISE LIBRARY
--    owner_id NULL  = global exercise (seeded, read-only to users)
--    owner_id = uid = user's custom exercise
-- ---------------------------------------------------------------------
create table public.exercises (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (char_length(name) between 1 and 80),
  muscle_group  text check (muscle_group in
                  ('chest','back','shoulders','biceps','triceps','legs','glutes','core','full_body','cardio','other')),
  equipment     text check (equipment in
                  ('barbell','dumbbell','machine','cable','bodyweight','kettlebell','band','other')),
  owner_id      uuid references auth.users(id) on delete cascade,
  created_at    timestamptz not null default now()
);
-- No duplicate names within global set or within one user's customs
create unique index exercises_global_name_uq on public.exercises (lower(name)) where owner_id is null;
create unique index exercises_owner_name_uq  on public.exercises (owner_id, lower(name)) where owner_id is not null;
create index exercises_muscle_group_idx on public.exercises (muscle_group);

-- ---------------------------------------------------------------------
-- 3. WORKOUT TEMPLATES / ROUTINES (planned: "Workout templates")
-- ---------------------------------------------------------------------
create table public.workout_templates (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 80),
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index workout_templates_user_idx on public.workout_templates (user_id);

create table public.template_exercises (
  id            uuid primary key default gen_random_uuid(),
  template_id   uuid not null references public.workout_templates(id) on delete cascade,
  exercise_id   uuid not null references public.exercises(id) on delete restrict,
  position      smallint not null default 0,
  target_sets   smallint check (target_sets between 1 and 50),
  target_reps   smallint check (target_reps between 1 and 1000),
  target_weight numeric(7,2) check (target_weight >= 0),
  rest_seconds  smallint check (rest_seconds between 0 and 3600)
);
create index template_exercises_template_idx on public.template_exercises (template_id);
create index template_exercises_exercise_idx on public.template_exercises (exercise_id);

-- ---------------------------------------------------------------------
-- 4. WORKOUTS  (frontend: Workout {id,name,date,duration,notes})
-- ---------------------------------------------------------------------
create table public.workouts (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  template_id       uuid references public.workout_templates(id) on delete set null,
  name              text not null check (char_length(name) between 1 and 80),
  workout_date      date not null default current_date,           -- frontend: date
  duration_minutes  integer not null default 0 check (duration_minutes between 0 and 1000), -- frontend: duration
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index workouts_user_date_idx on public.workouts (user_id, workout_date desc);
create index workouts_template_idx  on public.workouts (template_id);

-- (frontend: Exercise {id,name,sets}) — one row per exercise inside a workout
create table public.workout_exercises (
  id           uuid primary key default gen_random_uuid(),
  workout_id   uuid not null references public.workouts(id) on delete cascade,
  exercise_id  uuid not null references public.exercises(id) on delete restrict,
  position     smallint not null default 0,
  notes        text
);
create index workout_exercises_workout_idx  on public.workout_exercises (workout_id);
create index workout_exercises_exercise_idx on public.workout_exercises (exercise_id);

-- (frontend: ExerciseSet {id,reps,weight})
create table public.workout_sets (
  id                   uuid primary key default gen_random_uuid(),
  workout_exercise_id  uuid not null references public.workout_exercises(id) on delete cascade,
  set_number           smallint not null check (set_number >= 1),
  reps                 integer not null check (reps between 0 and 10000),
  weight               numeric(7,2) not null default 0 check (weight between 0 and 100000),
  is_warmup            boolean not null default false,
  rpe                  numeric(3,1) check (rpe between 1 and 10),
  unique (workout_exercise_id, set_number)
);

-- ---------------------------------------------------------------------
-- 5. BODYWEIGHT LOG + GOALS (planned features)
-- ---------------------------------------------------------------------
create table public.body_measurements (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  measured_on  date not null default current_date,
  bodyweight   numeric(6,2) not null check (bodyweight > 0),
  unique (user_id, measured_on)
);

create table public.goals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  goal_type     text not null check (goal_type in ('lift_weight','workouts_per_week','bodyweight','total_volume')),
  exercise_id   uuid references public.exercises(id) on delete cascade,   -- only for lift_weight
  target_value  numeric(10,2) not null check (target_value > 0),
  deadline      date,
  achieved_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index goals_user_idx on public.goals (user_id);
create index goals_exercise_idx on public.goals (exercise_id);

-- ---------------------------------------------------------------------
-- 6. updated_at trigger
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end; $$;

create trigger profiles_updated_at  before update on public.profiles          for each row execute function public.set_updated_at();
create trigger workouts_updated_at  before update on public.workouts          for each row execute function public.set_updated_at();
create trigger templates_updated_at before update on public.workout_templates for each row execute function public.set_updated_at();

-- =====================================================================
-- 7. ROW LEVEL SECURITY — every user sees only their own data
-- =====================================================================
alter table public.profiles           enable row level security;
alter table public.exercises          enable row level security;
alter table public.workout_templates  enable row level security;
alter table public.template_exercises enable row level security;
alter table public.workouts           enable row level security;
alter table public.workout_exercises  enable row level security;
alter table public.workout_sets       enable row level security;
alter table public.body_measurements  enable row level security;
alter table public.goals              enable row level security;

-- profiles (insert handled by trigger)
create policy "profiles: read own"   on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "profiles: update own" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- exercises: read global + own; write only own
create policy "exercises: read global or own" on public.exercises for select to authenticated
  using (owner_id is null or owner_id = (select auth.uid()));
create policy "exercises: insert own" on public.exercises for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "exercises: update own" on public.exercises for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "exercises: delete own" on public.exercises for delete to authenticated using (owner_id = (select auth.uid()));

-- simple owner tables
create policy "workouts: own"          on public.workouts          for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "templates: own"         on public.workout_templates for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "body_measurements: own" on public.body_measurements for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "goals: own"             on public.goals             for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- child tables: ownership via parent
create policy "workout_exercises: via workout" on public.workout_exercises for all to authenticated
  using      (exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = (select auth.uid())))
  with check (exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = (select auth.uid())));

create policy "workout_sets: via workout" on public.workout_sets for all to authenticated
  using (exists (
    select 1 from public.workout_exercises we join public.workouts w on w.id = we.workout_id
    where we.id = workout_exercise_id and w.user_id = (select auth.uid())))
  with check (exists (
    select 1 from public.workout_exercises we join public.workouts w on w.id = we.workout_id
    where we.id = workout_exercise_id and w.user_id = (select auth.uid())));

create policy "template_exercises: via template" on public.template_exercises for all to authenticated
  using      (exists (select 1 from public.workout_templates t where t.id = template_id and t.user_id = (select auth.uid())))
  with check (exists (select 1 from public.workout_templates t where t.id = template_id and t.user_id = (select auth.uid())));

-- =====================================================================
-- 8. VIEWS for Dashboard / History / Progress pages
--    security_invoker = RLS of the caller applies
-- =====================================================================

-- One row per workout with the stats WorkoutRow shows
create view public.workout_summaries with (security_invoker = true) as
select
  w.id, w.user_id, w.name, w.workout_date, w.duration_minutes, w.notes,
  count(distinct we.id)                              as exercise_count,
  count(s.id) filter (where not s.is_warmup)         as set_count,
  coalesce(sum(s.reps * s.weight) filter (where not s.is_warmup), 0) as total_volume
from public.workouts w
left join public.workout_exercises we on we.workout_id = w.id
left join public.workout_sets s       on s.workout_exercise_id = we.id
group by w.id;

-- Personal records per exercise (heaviest weight, best estimated 1RM via Epley)
create view public.personal_records with (security_invoker = true) as
select
  w.user_id,
  e.id   as exercise_id,
  e.name as exercise_name,
  max(s.weight)                                     as max_weight,
  max(s.reps * s.weight)                            as best_set_volume,
  round(max(s.weight * (1 + s.reps / 30.0)), 1)     as est_one_rep_max
from public.workout_sets s
join public.workout_exercises we on we.id = s.workout_exercise_id
join public.workouts w           on w.id = we.workout_id
join public.exercises e          on e.id = we.exercise_id
where not s.is_warmup and s.reps > 0
group by w.user_id, e.id, e.name;

-- =====================================================================
-- 9. RPC: save a whole workout (matches the WorkoutForm payload) atomically
--    supabase.rpc('save_workout', { payload })
--    payload = { name, date, duration, notes,
--                exercises: [{ exercise_id, sets: [{ reps, weight }] }] }
-- =====================================================================
create or replace function public.save_workout(payload jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_workout_id uuid;
  v_we_id      uuid;
  ex           jsonb;
  st           jsonb;
  ex_pos       int := 0;
  set_no       int;
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated';
  end if;
  if jsonb_array_length(coalesce(payload->'exercises', '[]'::jsonb)) = 0 then
    raise exception 'workout must contain at least one exercise';
  end if;

  insert into public.workouts (user_id, name, workout_date, duration_minutes, notes)
  values ((select auth.uid()),
          payload->>'name',
          coalesce((payload->>'date')::date, current_date),
          coalesce((payload->>'duration')::int, 0),
          nullif(payload->>'notes', ''))
  returning id into v_workout_id;

  for ex in select * from jsonb_array_elements(payload->'exercises') loop
    ex_pos := ex_pos + 1;
    insert into public.workout_exercises (workout_id, exercise_id, position, notes)
    values (v_workout_id, (ex->>'exercise_id')::uuid, ex_pos, ex->>'notes')
    returning id into v_we_id;

    set_no := 0;
    for st in select * from jsonb_array_elements(ex->'sets') loop
      set_no := set_no + 1;
      insert into public.workout_sets (workout_exercise_id, set_number, reps, weight)
      values (v_we_id, set_no, (st->>'reps')::int, coalesce((st->>'weight')::numeric, 0));
    end loop;
  end loop;

  return v_workout_id;
end;
$$;

revoke execute on function public.save_workout(jsonb) from public, anon;
grant  execute on function public.save_workout(jsonb) to authenticated;

-- =====================================================================
-- 10. SEED the global exercise library (the frontend's EXERCISES list + a few)
-- =====================================================================
insert into public.exercises (name, muscle_group, equipment) values
  ('Bench Press',            'chest',     'barbell'),
  ('Incline Dumbbell Press', 'chest',     'dumbbell'),
  ('Cable Fly',              'chest',     'cable'),
  ('Squat',                  'legs',      'barbell'),
  ('Leg Press',              'legs',      'machine'),
  ('Deadlift',               'back',      'barbell'),
  ('Lat Pulldown',           'back',      'cable'),
  ('Seated Row',             'back',      'cable'),
  ('Overhead Press',         'shoulders', 'barbell'),
  ('Lateral Raises',         'shoulders', 'dumbbell'),
  ('Bicep Curl',             'biceps',    'dumbbell'),
  ('Tricep Pushdown',        'triceps',   'cable'),
  ('Romanian Deadlift',      'legs',      'barbell'),
  ('Pull-Up',                'back',      'bodyweight'),
  ('Plank',                  'core',      'bodyweight');
