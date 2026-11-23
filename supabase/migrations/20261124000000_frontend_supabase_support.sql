-- =====================================================================
-- Support moving the frontend from localStorage to Supabase
--   1. Readable set validation (weight 100000 hit a raw numeric overflow)
--   2. save_workout: decimal durations, exercise lookup by name,
--      custom exercises created on the fly (needed to import localStorage data)
--   3. update_workout RPC (edit a logged workout atomically)
--   4. personal_record_sets view (heaviest set + reps + date, PR tracker branch)
--   5. Exercise references must be visible to the caller (global or own)
--   6. handle_new_user is a trigger only; not callable through the API
-- =====================================================================

-- ---------------------------------------------------------------------
-- 2 + 3. Workout write RPCs (with set validation)
--    payload = { name, date, duration, notes,
--                exercises: [{ exercise_id? , name?, notes?, sets: [{ reps, weight }] }] }
--    Each exercise needs exercise_id OR name. A name is matched (case-insensitive)
--    against the global library and the caller's own exercises; if neither has it,
--    a custom exercise is created for the caller.
-- ---------------------------------------------------------------------
create or replace function public.resolve_exercise_id(p_exercise jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id   uuid;
  v_name text := nullif(trim(p_exercise->>'name'), '');
begin
  if nullif(p_exercise->>'exercise_id', '') is not null then
    -- RLS limits this to global + own exercises
    select e.id into v_id from public.exercises e where e.id = (p_exercise->>'exercise_id')::uuid;
    if v_id is null then
      raise exception 'exercise % not found', p_exercise->>'exercise_id';
    end if;
    return v_id;
  end if;

  if v_name is null then
    raise exception 'each exercise needs an exercise_id or a name';
  end if;

  -- prefer the user's own exercise over a global one with the same name
  select e.id into v_id from public.exercises e
  where lower(e.name) = lower(v_name)
  order by (e.owner_id is null)
  limit 1;

  if v_id is null then
    insert into public.exercises (name, muscle_group, owner_id)
    values (v_name, 'other', (select auth.uid()))
    returning id into v_id;
  end if;
  return v_id;
end;
$$;

-- Insert exercises + sets for a workout the caller owns.
create or replace function public.write_workout_children(p_workout_id uuid, p_exercises jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_we_id  uuid;
  v_ex_id  uuid;
  v_reps   numeric;
  v_weight numeric;
  ex       jsonb;
  st       jsonb;
  ex_pos   int := 0;
  set_no   int;
begin
  if jsonb_array_length(coalesce(p_exercises, '[]'::jsonb)) = 0 then
    raise exception 'workout must contain at least one exercise';
  end if;

  for ex in select * from jsonb_array_elements(p_exercises) loop
    ex_pos := ex_pos + 1;
    if jsonb_array_length(coalesce(ex->'sets', '[]'::jsonb)) = 0 then
      raise exception 'exercise % has no sets', ex_pos;
    end if;

    -- resolve first: a custom exercise created here must be visible to the
    -- RLS check on the insert below, which runs in a later statement
    v_ex_id := public.resolve_exercise_id(ex);
    insert into public.workout_exercises (workout_id, exercise_id, position, notes)
    values (p_workout_id, v_ex_id, ex_pos, nullif(ex->>'notes', ''))
    returning id into v_we_id;

    set_no := 0;
    for st in select * from jsonb_array_elements(ex->'sets') loop
      set_no   := set_no + 1;
      v_reps   := (st->>'reps')::numeric;
      v_weight := coalesce((st->>'weight')::numeric, 0);
      if v_reps is null or v_reps <> trunc(v_reps) or v_reps < 1 or v_reps > 10000 then
        raise exception 'exercise % set %: reps must be a whole number from 1 to 10000', ex_pos, set_no
          using errcode = 'check_violation';
      end if;
      if v_weight < 0 or v_weight >= 100000 then
        raise exception 'exercise % set %: weight must be from 0 to 99999.99', ex_pos, set_no
          using errcode = 'check_violation';
      end if;
      insert into public.workout_sets (workout_exercise_id, set_number, reps, weight)
      values (v_we_id, set_no, v_reps::int, v_weight);
    end loop;
  end loop;
end;
$$;

create or replace function public.save_workout(payload jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_workout_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated';
  end if;

  insert into public.workouts (user_id, name, workout_date, duration_minutes, notes)
  values ((select auth.uid()),
          trim(payload->>'name'),
          coalesce((payload->>'date')::date, current_date),
          coalesce(round((payload->>'duration')::numeric)::int, 0),   -- "45.5" no longer fails
          nullif(payload->>'notes', ''))
  returning id into v_workout_id;

  perform public.write_workout_children(v_workout_id, payload->'exercises');
  return v_workout_id;
end;
$$;

-- Replace a workout's header, exercises and sets in one transaction.
create or replace function public.update_workout(p_workout_id uuid, payload jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated';
  end if;

  update public.workouts set
    name             = trim(payload->>'name'),
    workout_date     = coalesce((payload->>'date')::date, workout_date),
    duration_minutes = coalesce(round((payload->>'duration')::numeric)::int, duration_minutes),
    notes            = nullif(payload->>'notes', '')
  where id = p_workout_id;               -- RLS: only the owner's row matches

  if not found then
    raise exception 'workout % not found', p_workout_id;
  end if;

  delete from public.workout_exercises where workout_id = p_workout_id;  -- sets cascade
  perform public.write_workout_children(p_workout_id, payload->'exercises');
  return p_workout_id;
end;
$$;

revoke execute on function public.resolve_exercise_id(jsonb)           from public, anon, authenticated;
revoke execute on function public.write_workout_children(uuid, jsonb)  from public, anon, authenticated;
revoke execute on function public.save_workout(jsonb)                  from public, anon;
revoke execute on function public.update_workout(uuid, jsonb)          from public, anon;
grant  execute on function public.save_workout(jsonb)                  to authenticated;
grant  execute on function public.update_workout(uuid, jsonb)          to authenticated;
-- the helpers run inside the RPCs, which are invoker functions, so the caller
-- needs execute on them too; they are harmless on their own (RLS still applies)
grant  execute on function public.resolve_exercise_id(jsonb)           to authenticated;
grant  execute on function public.write_workout_children(uuid, jsonb)  to authenticated;

-- ---------------------------------------------------------------------
-- 4. Personal record set per exercise: heaviest weight, ties -> more reps,
--    then the earliest date it was hit (same rule as trainingInsights.ts)
-- ---------------------------------------------------------------------
create view public.personal_record_sets with (security_invoker = true) as
select distinct on (w.user_id, e.id)
  w.user_id,
  e.id          as exercise_id,
  e.name        as exercise_name,
  s.weight,
  s.reps,
  w.workout_date as achieved_on,
  w.id          as workout_id
from public.workout_sets s
join public.workout_exercises we on we.id = s.workout_exercise_id
join public.workouts w           on w.id = we.workout_id
join public.exercises e          on e.id = we.exercise_id
where not s.is_warmup and s.reps > 0
order by w.user_id, e.id, s.weight desc, s.reps desc, w.workout_date asc;

-- ---------------------------------------------------------------------
-- 5. A user may only reference exercises they can see (global or own).
--    Before, any exercise uuid (e.g. another user's custom exercise) passed.
-- ---------------------------------------------------------------------
create or replace function public.exercise_visible(p_exercise_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.exercises e
    where e.id = p_exercise_id
      and (e.owner_id is null or e.owner_id = (select auth.uid())));
$$;

drop policy "workout_exercises: via workout" on public.workout_exercises;
create policy "workout_exercises: via workout" on public.workout_exercises for all to authenticated
  using      (exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = (select auth.uid())))
  with check (exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = (select auth.uid()))
              and public.exercise_visible(exercise_id));

drop policy "template_exercises: via template" on public.template_exercises;
create policy "template_exercises: via template" on public.template_exercises for all to authenticated
  using      (exists (select 1 from public.workout_templates t where t.id = template_id and t.user_id = (select auth.uid())))
  with check (exists (select 1 from public.workout_templates t where t.id = template_id and t.user_id = (select auth.uid()))
              and public.exercise_visible(exercise_id));

drop policy "goals: own" on public.goals;
create policy "goals: own" on public.goals for all to authenticated
  using      (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (exercise_id is null or public.exercise_visible(exercise_id)));

-- ---------------------------------------------------------------------
-- 6. Trigger function should not be exposed as /rest/v1/rpc/handle_new_user
-- ---------------------------------------------------------------------
revoke execute on function public.handle_new_user() from public, anon, authenticated;
