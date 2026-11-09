-- Row Level Security: users can only see and change their own data.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'alice@test.com', '{"display_name":"Alice"}'),
  ('22222222-2222-2222-2222-222222222222', 'bob@test.com',   '{}');

select is(
  (select display_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'Alice',
  'signup trigger creates a profile using display_name metadata'
);
select is(
  (select display_name from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  'bob',
  'signup trigger falls back to the email prefix'
);

-- ---- act as Alice -------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

insert into public.workouts (name, workout_date, duration_minutes) values ('Alice Push', '2026-11-07', 60);
insert into public.workout_exercises (workout_id, exercise_id, position)
  select w.id, e.id, 1 from public.workouts w, public.exercises e
  where w.name = 'Alice Push' and e.name = 'Bench Press';
insert into public.workout_sets (workout_exercise_id, set_number, reps, weight)
  select id, 1, 8, 135 from public.workout_exercises;
insert into public.body_measurements (bodyweight) values (180);

select is((select count(*)::int from public.workouts), 1, 'Alice sees her workout');
select is((select user_id from public.workouts limit 1), '11111111-1111-1111-1111-111111111111'::uuid,
  'user_id defaults to the signed-in user');
select is((select count(*)::int from public.profiles), 1, 'Alice sees only her own profile');

-- ---- act as Bob ---------------------------------------------------
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select is((select count(*)::int from public.workouts),          0, 'Bob cannot see Alice''s workouts');
select is((select count(*)::int from public.workout_exercises), 0, 'Bob cannot see Alice''s workout exercises');
select is((select count(*)::int from public.workout_sets),      0, 'Bob cannot see Alice''s sets');
select is((select count(*)::int from public.body_measurements), 0, 'Bob cannot see Alice''s bodyweight');

select throws_ok(
  $$ insert into public.workouts (user_id, name) values ('11111111-1111-1111-1111-111111111111', 'Sneaky') $$,
  '42501', null,
  'Bob cannot create a workout owned by Alice'
);

-- Bob can read the global library and add his own exercise, but not a global one
select lives_ok(
  $$ insert into public.exercises (name, muscle_group, owner_id)
     values ('Bob Custom Curl', 'biceps', '22222222-2222-2222-2222-222222222222') $$,
  'Bob can add a custom exercise'
);
select throws_ok(
  $$ insert into public.exercises (name) values ('Fake Global Lift') $$,
  '42501', null,
  'Bob cannot add to the global exercise library'
);

select * from finish();
rollback;
