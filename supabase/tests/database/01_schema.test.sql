-- Schema smoke tests: tables, RLS, views, functions and seed data exist.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

select has_table('public', 'profiles',           'profiles table exists');
select has_table('public', 'exercises',          'exercises table exists');
select has_table('public', 'workouts',           'workouts table exists');
select has_table('public', 'workout_exercises',  'workout_exercises table exists');
select has_table('public', 'workout_sets',       'workout_sets table exists');
select has_table('public', 'workout_templates',  'workout_templates table exists');
select has_table('public', 'template_exercises', 'template_exercises table exists');
select has_table('public', 'body_measurements',  'body_measurements table exists');
select has_table('public', 'goals',              'goals table exists');

select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  0,
  'every public table has row level security enabled'
);

select has_view('public', 'workout_summaries', 'workout_summaries view exists');
select has_view('public', 'personal_records',  'personal_records view exists');

select has_function('public', 'save_workout', array['jsonb'], 'save_workout(jsonb) exists');
select ok(
  not has_function_privilege('anon', 'public.save_workout(jsonb)', 'execute'),
  'anon cannot execute save_workout'
);
select ok(
  has_function_privilege('authenticated', 'public.save_workout(jsonb)', 'execute'),
  'authenticated can execute save_workout'
);

select is(
  (select count(*)::int from public.exercises where owner_id is null),
  15,
  'global exercise library is seeded'
);
select ok(
  (select count(*) from public.exercises
    where owner_id is null and name in
      ('Bench Press','Incline Dumbbell Press','Squat','Deadlift','Lat Pulldown','Seated Row',
       'Lateral Raises','Bicep Curl','Tricep Pushdown','Leg Press','Overhead Press','Cable Fly')) = 12,
  'all 12 exercises from the frontend picker are in the library'
);

select * from finish();
rollback;
