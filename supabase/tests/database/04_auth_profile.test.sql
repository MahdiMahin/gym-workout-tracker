-- Registration trigger, username rules and profile updates.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

-- ---- sign-up trigger ------------------------------------------------
select lives_ok(
  $$ insert into auth.users (id, email, raw_user_meta_data) values
     ('33333333-3333-3333-3333-333333333333', 'long@test.com',
      jsonb_build_object('display_name', repeat('a', 100))) $$,
  'sign-up with a 100-char display name succeeds'
);
select is(
  (select char_length(display_name) from public.profiles where id = '33333333-3333-3333-3333-333333333333'),
  60, 'display name is cut to 60 chars'
);

select lives_ok(
  $$ insert into auth.users (id, email) values
     ('44444444-4444-4444-4444-444444444444', repeat('b', 70) || '@test.com') $$,
  'sign-up with a 70-char email prefix succeeds'
);
select is(
  (select char_length(display_name) from public.profiles where id = '44444444-4444-4444-4444-444444444444'),
  60, 'email-prefix display name is cut to 60 chars'
);

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'alice@test.com', '{"username":"Alice_01"}');
select is(
  (select username from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'alice_01', 'username from sign-up metadata is stored lowercase'
);

select lives_ok(
  $$ insert into auth.users (id, email, raw_user_meta_data) values
     ('55555555-5555-5555-5555-555555555555', 'bob@test.com', '{"username":"ALICE_01"}') $$,
  'sign-up with a taken username still succeeds'
);
select is(
  (select username from public.profiles where id = '55555555-5555-5555-5555-555555555555'),
  null, 'taken username is left empty'
);

insert into auth.users (id, email, raw_user_meta_data) values
  ('66666666-6666-6666-6666-666666666666', 'carol@test.com', '{"username":"a!"}');
select is(
  (select username from public.profiles where id = '66666666-6666-6666-6666-666666666666'),
  null, 'invalid username is left empty'
);

-- ---- username availability, before sign-up (anon) -------------------
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select is(public.is_username_available('Alice_01'), false, 'taken username is not available (case-insensitive)');
select is(public.is_username_available('new_lifter'), true, 'free username is available');
select is(public.is_username_available('x'), false, 'too-short username is not available');

-- ---- profile updates as Bob -----------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}';

select lives_ok(
  $$ update public.profiles set username = 'bob_lifts', bio = 'Push pull legs', experience_level = 'beginner'
     where id = '55555555-5555-5555-5555-555555555555' $$,
  'Bob can update his own profile'
);
select throws_ok(
  $$ update public.profiles set username = 'alice_01' where id = '55555555-5555-5555-5555-555555555555' $$,
  '23505', null, 'Bob cannot take a username that is in use'
);
select throws_ok(
  $$ update public.profiles set username = 'Bad Name' where id = '55555555-5555-5555-5555-555555555555' $$,
  '23514', null, 'username must be lowercase letters, numbers or _'
);
select throws_ok(
  $$ update public.profiles set bio = repeat('x', 281) where id = '55555555-5555-5555-5555-555555555555' $$,
  '23514', null, 'bio is limited to 280 chars'
);
select throws_ok(
  $$ update public.profiles set experience_level = 'expert' where id = '55555555-5555-5555-5555-555555555555' $$,
  '23514', null, 'experience_level must be one of the allowed values'
);

-- Bob tries to edit Alice's profile: RLS makes it match no rows
update public.profiles set bio = 'hacked' where id = '11111111-1111-1111-1111-111111111111';
reset role;
select is(
  (select bio from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  null, 'Bob cannot change another user''s profile'
);

select * from finish();
rollback;
