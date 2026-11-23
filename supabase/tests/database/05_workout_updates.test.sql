-- Migration 20261124000000: exercise-by-name saves, update_workout,
-- personal_record_sets, set validation and exercise visibility.
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

select has_function('public', 'update_workout', array['uuid', 'jsonb'], 'update_workout(uuid, jsonb) exists');
select ok(not has_function_privilege('anon', 'public.update_workout(uuid, jsonb)', 'execute'), 'anon cannot call update_workout');
select ok(has_function_privilege('authenticated', 'public.update_workout(uuid, jsonb)', 'execute'), 'authenticated can call update_workout');
select has_view('public', 'personal_record_sets', 'personal_record_sets view exists');
select ok(not has_function_privilege('anon', 'public.handle_new_user()', 'execute'), 'anon cannot call handle_new_user');
select ok(not has_function_privilege('authenticated', 'public.handle_new_user()', 'execute'), 'authenticated cannot call handle_new_user');

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice@test.com'),
  ('22222222-2222-2222-2222-222222222222', 'bob@test.com');

-- ---- act as Alice -------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- localStorage shape: exercises by name, decimal duration, one unknown exercise
select isnt(
  public.save_workout('{"name":"Push Day","date":"2026-11-07","duration":"45.5","exercises":[
    {"name":"bench press","sets":[{"reps":8,"weight":135},{"reps":10,"weight":135}]},
    {"name":"Cable Crossover","sets":[{"reps":12,"weight":22.5}]}]}'::jsonb),
  null,
  'save_workout accepts exercises by name'
);

select is(
  (select e.owner_id from public.workout_exercises we join public.exercises e on e.id = we.exercise_id where we.position = 1),
  null,
  'a library name matches the global exercise, case-insensitively'
);
select is(
  (select owner_id from public.exercises where name = 'Cable Crossover'),
  '11111111-1111-1111-1111-111111111111'::uuid,
  'an unknown name becomes a custom exercise owned by the user'
);
select is((select duration_minutes from public.workouts where name = 'Push Day'), 46, 'a decimal duration is rounded');

-- Heaviest weight wins, ties go to more reps (same rule as trainingInsights.ts)
select results_eq(
  $$ select weight, reps, achieved_on from public.personal_record_sets where exercise_name = 'Bench Press' $$,
  $$ values (135.00::numeric, 10, '2026-11-07'::date) $$,
  'personal_record_sets gives the heaviest set with its reps and date'
);

select is(
  public.update_workout(
    (select id from public.workouts where name = 'Push Day'),
    '{"name":"Leg Day","date":"2026-11-08","duration":50,"exercises":[{"name":"Squat","sets":[{"reps":5,"weight":225}]}]}'::jsonb),
  (select id from public.workouts where name = 'Push Day'),
  'update_workout returns the same workout id'
);
select results_eq(
  $$ select name, workout_date, duration_minutes, exercise_count::int, total_volume from public.workout_summaries $$,
  $$ values ('Leg Day'::text, '2026-11-08'::date, 50, 1, 1125.00::numeric) $$,
  'update_workout replaces the header, exercises and sets'
);

select throws_ok(
  $$ select public.save_workout('{"name":"Heavy","exercises":[{"name":"Squat","sets":[{"reps":1,"weight":100000}]}]}'::jsonb) $$,
  '23514', 'exercise 1 set 1: weight must be from 0 to 99999.99',
  'a weight of 100000 gets a readable error instead of a numeric overflow'
);
select throws_ok(
  $$ select public.save_workout('{"name":"Partial","exercises":[{"name":"Squat","sets":[{"reps":2.5,"weight":100}]}]}'::jsonb) $$,
  '23514', 'exercise 1 set 1: reps must be a whole number from 1 to 10000',
  'fractional reps are rejected'
);
select throws_ok(
  $$ select public.save_workout('{"name":"No sets","exercises":[{"name":"Squat","sets":[]}]}'::jsonb) $$,
  'P0001', 'exercise 1 has no sets',
  'an exercise without sets is rejected'
);

select isnt(set_config('test.alice_workout', (select id::text from public.workouts where name = 'Leg Day'), true), null, 'remember Alice''s workout id for the Bob tests');
insert into public.exercises (id, name, owner_id)
  values ('33333333-3333-3333-3333-333333333333', 'Alice Sled Push', '11111111-1111-1111-1111-111111111111');

-- ---- act as Bob ---------------------------------------------------
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select throws_ok(
  $$ select public.update_workout(
       current_setting('test.alice_workout')::uuid,
       '{"name":"Hijack","exercises":[{"name":"Squat","sets":[{"reps":1,"weight":1}]}]}'::jsonb) $$,
  'P0001', null,
  'Bob cannot see or edit Alice''s workout'
);
select throws_ok(
  $$ select public.save_workout('{"name":"Borrow","exercises":[{"exercise_id":"33333333-3333-3333-3333-333333333333","sets":[{"reps":1,"weight":1}]}]}'::jsonb) $$,
  'P0001', 'exercise 33333333-3333-3333-3333-333333333333 not found',
  'save_workout rejects another user''s custom exercise'
);

insert into public.workouts (name) values ('Bob Raw');
select throws_ok(
  $$ insert into public.workout_exercises (workout_id, exercise_id)
     select id, '33333333-3333-3333-3333-333333333333' from public.workouts where name = 'Bob Raw' $$,
  '42501', null,
  'RLS blocks a direct insert that references another user''s custom exercise'
);

select * from finish();
rollback;
