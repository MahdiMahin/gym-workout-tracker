-- save_workout RPC and the stats views used by Dashboard / History / Progress.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice@test.com'),
  ('22222222-2222-2222-2222-222222222222', 'bob@test.com');

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- Same shape as the frontend's "Push Day" demo workout
select isnt(
  public.save_workout(jsonb_build_object(
    'name', 'Push Day', 'date', '2026-11-07', 'duration', 62, 'notes', 'Felt strong',
    'exercises', jsonb_build_array(
      jsonb_build_object('exercise_id', (select id from public.exercises where name = 'Bench Press'),
        'sets', '[{"reps":8,"weight":135},{"reps":8,"weight":135},{"reps":6,"weight":145}]'::jsonb),
      jsonb_build_object('exercise_id', (select id from public.exercises where name = 'Incline Dumbbell Press'),
        'sets', '[{"reps":10,"weight":50},{"reps":9,"weight":50}]'::jsonb),
      jsonb_build_object('exercise_id', (select id from public.exercises where name = 'Lateral Raises'),
        'sets', '[{"reps":12,"weight":20},{"reps":12,"weight":20}]'::jsonb)
    ))),
  null,
  'save_workout returns the new workout id'
);

select is((select count(*)::int from public.workout_exercises), 3, 'three exercises saved');
select results_eq(
  $$ select s.set_number::int from public.workout_sets s
     join public.workout_exercises we on we.id = s.workout_exercise_id
     where we.position = 1 order by s.set_number $$,
  array[1, 2, 3],
  'sets are numbered in the order sent'
);

-- Frontend workoutVolume() gives 3030 + 950 + 480 = 4460 for this workout
select results_eq(
  $$ select exercise_count::int, set_count::int, total_volume::numeric
     from public.workout_summaries where name = 'Push Day' $$,
  $$ values (3, 7, 4460.00::numeric) $$,
  'workout_summaries matches the frontend volume and set count'
);

select results_eq(
  $$ select max_weight, est_one_rep_max from public.personal_records where exercise_name = 'Bench Press' $$,
  $$ values (145.00::numeric, 174.0::numeric) $$,
  'personal_records gives heaviest set and Epley 1RM'
);

select throws_ok(
  $$ select public.save_workout('{"name":"Empty","exercises":[]}'::jsonb) $$,
  'P0001', 'workout must contain at least one exercise',
  'save_workout rejects a workout with no exercises'
);

select throws_ok(
  $$ select public.save_workout(jsonb_build_object('name', 'Bad reps', 'exercises', jsonb_build_array(
       jsonb_build_object('exercise_id', (select id from public.exercises where name = 'Squat'),
         'sets', '[{"reps":-1,"weight":100}]'::jsonb)))) $$,
  '23514', null,
  'negative reps are rejected by a check constraint'
);

-- Bob sees none of Alice's stats
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select is((select count(*)::int from public.workout_summaries), 0, 'Bob sees no workout summaries');
select is((select count(*)::int from public.personal_records),  0, 'Bob sees no personal records');

select * from finish();
rollback;
