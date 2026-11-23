-- =====================================================================
-- User registration, login and profile
--
-- Registration and login are handled by Supabase Auth (auth.users);
-- the frontend calls supabase.auth.signUp / signInWithPassword.
-- This migration covers the database side:
--   1. new profile fields: username, bio, experience_level
--   2. a safer sign-up trigger (long names no longer break sign-up,
--      username is taken from sign-up metadata when valid and free)
--   3. is_username_available() so the registration form can check a
--      username before the account exists
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Profile fields
-- ---------------------------------------------------------------------
alter table public.profiles
  add column username         text unique
    check (username ~ '^[a-z0-9_]{3,20}$'),           -- lowercase, 3-20 chars
  add column bio              text
    check (char_length(bio) <= 280),
  add column experience_level text
    check (experience_level in ('beginner','intermediate','advanced'));

-- ---------------------------------------------------------------------
-- 2. Sign-up trigger
--    Before: a display_name (or email prefix) over 60 chars violated the
--    profiles check and made the whole sign-up fail.
--    Now: display_name is cut to 60 chars; username comes from
--    raw_user_meta_data->>'username' if it is valid and not taken,
--    otherwise it is left empty for the user to set on the profile page.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_display_name text;
  v_username     text;
begin
  v_display_name := left(
    coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
             split_part(new.email, '@', 1)),
    60);

  v_username := lower(trim(new.raw_user_meta_data->>'username'));
  if v_username is null or v_username !~ '^[a-z0-9_]{3,20}$' then
    v_username := null;
  end if;

  begin
    insert into public.profiles (id, display_name, username)
    values (new.id, v_display_name, v_username);
  exception when unique_violation then
    -- username was taken between the availability check and sign-up
    insert into public.profiles (id, display_name)
    values (new.id, v_display_name);
  end;

  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Username availability (callable before sign-up, so anon can use it)
--    security definer so it can see other users' usernames through RLS;
--    it only ever returns true/false.
-- ---------------------------------------------------------------------
create or replace function public.is_username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select lower(p_username) ~ '^[a-z0-9_]{3,20}$'
     and not exists (select 1 from public.profiles where username = lower(p_username));
$$;

revoke execute on function public.is_username_available(text) from public;
grant  execute on function public.is_username_available(text) to anon, authenticated;
