-- Run as postgres against a disposable migrated DB: psql -X -v ON_ERROR_STOP=1 -f this_file
-- No pgTAP dependency. Every assertion raises on failure; fixtures always roll back.
begin;
select set_config('request.jwt.claim.sub', '', true);

create function pg_temp.fixture_id(n integer) returns uuid language sql immutable as $$
  select ('c0030000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid;
$$;

create function pg_temp.expect_rows(statement text, expected bigint) returns void
language plpgsql as $$
declare actual bigint;
begin
  execute statement;
  get diagnostics actual = row_count;
  if actual <> expected then
    raise exception 'Expected % rows, got %: %', expected, actual, statement;
  end if;
end;
$$;

create function pg_temp.expect_error(statement text, expected_state text) returns void
language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if sqlstate = expected_state then return; end if;
    raise exception 'Expected SQLSTATE %, got %: % (%)', expected_state, sqlstate, statement, sqlerrm;
  end;
  raise exception 'Expected SQLSTATE %, but succeeded: %', expected_state, statement;
end;
$$;

-- These helpers use caller privileges; none bypass RLS via SECURITY DEFINER.
create function pg_temp.seed_owner(actor integer) returns void language plpgsql as $$
begin
  insert into public.cover_letters (id, user_id, company_name, job_title, updated_at) values
    (pg_temp.fixture_id(10 + actor), pg_temp.fixture_id(actor), '테스트 회사', '개발자', '2000-01-01'),
    (pg_temp.fixture_id(20 + actor), pg_temp.fixture_id(actor), '두 번째 회사', '개발자', '2000-01-01');
  insert into public.essay_items (id, cover_letter_id, question) values
    (pg_temp.fixture_id(30 + actor), pg_temp.fixture_id(10 + actor), '지원 동기');
  insert into public.experiences (id, cover_letter_id, content) values
    (pg_temp.fixture_id(40 + actor), pg_temp.fixture_id(10 + actor), '프로젝트 경험');
  insert into public.interviews (id, cover_letter_id, user_id) values
    (pg_temp.fixture_id(50 + actor), pg_temp.fixture_id(10 + actor), pg_temp.fixture_id(actor)),
    (pg_temp.fixture_id(60 + actor), pg_temp.fixture_id(20 + actor), pg_temp.fixture_id(actor));
  insert into public.interview_questions (id, interview_id, type, order_index, question_text) values
    (pg_temp.fixture_id(70 + actor), pg_temp.fixture_id(50 + actor), 'main', 0, '자기소개'),
    (pg_temp.fixture_id(90 + actor), pg_temp.fixture_id(60 + actor), 'main', 0, '두 번째 면접');
  insert into public.interview_questions
    (id, interview_id, type, parent_question_id, order_index, question_text) values
    (pg_temp.fixture_id(80 + actor), pg_temp.fixture_id(50 + actor), 'follow_up',
      pg_temp.fixture_id(70 + actor), 0, '구체적인 사례');
end;
$$;

create function pg_temp.check_owner(actor integer) returns void language plpgsql as $$
declare
  peer integer := 3 - actor;
  target record;
  own_id uuid;
  peer_id uuid;
begin
  if current_user <> 'authenticated' or auth.uid() is distinct from pg_temp.fixture_id(actor) then
    raise exception 'Wrong role/JWT subject for actor %', actor;
  end if;

  for target in select * from (values
    ('cover_letters', 10), ('essay_items', 30), ('experiences', 40),
    ('interviews', 50), ('interview_questions', 70)
  ) as targets(name, base) loop
    own_id := pg_temp.fixture_id(target.base + actor);
    peer_id := pg_temp.fixture_id(target.base + peer);
    perform pg_temp.expect_rows(format('select * from public.%I where id = %L', target.name, own_id), 1);
    perform pg_temp.expect_rows(format('update public.%I set id = id where id = %L', target.name, own_id), 1);
    perform pg_temp.expect_rows(format('select * from public.%I where id = %L', target.name, peer_id), 0);
    perform pg_temp.expect_rows(format('update public.%I set id = id where id = %L', target.name, peer_id), 0);
    perform pg_temp.expect_rows(format('delete from public.%I where id = %L', target.name, peer_id), 0);
    perform pg_temp.expect_error(format('truncate public.%I cascade', target.name), '42501');
  end loop;

  -- Ownership spoofing and transfer are forbidden on both INSERT and UPDATE.
  perform pg_temp.expect_error(format(
    'insert into public.cover_letters (user_id, company_name, job_title) values (%L, ''x'', ''x'')',
    pg_temp.fixture_id(peer)), '42501');
  perform pg_temp.expect_error(format(
    'update public.cover_letters set user_id = %L where id = %L',
    pg_temp.fixture_id(peer), pg_temp.fixture_id(10 + actor)), '42501');
  perform pg_temp.expect_error(format(
    'insert into public.interviews (user_id, cover_letter_id) values (%L, %L)',
    pg_temp.fixture_id(peer), pg_temp.fixture_id(10 + actor)), '42501');
  perform pg_temp.expect_error(format(
    'update public.interviews set user_id = %L where id = %L',
    pg_temp.fixture_id(peer), pg_temp.fixture_id(50 + actor)), '42501');

  -- Child reparenting: the new parent must belong to the current account.
  perform pg_temp.expect_error(format(
    'insert into public.essay_items (cover_letter_id, question) values (%L, ''x'')',
    pg_temp.fixture_id(10 + peer)), '42501');
  perform pg_temp.expect_error(format(
    'insert into public.experiences (cover_letter_id, content) values (%L, ''x'')',
    pg_temp.fixture_id(10 + peer)), '42501');
  perform pg_temp.expect_error(format(
    'insert into public.interviews (user_id, cover_letter_id) values (%L, %L)',
    pg_temp.fixture_id(actor), pg_temp.fixture_id(10 + peer)), '42501');
  for target in select * from (values
    ('essay_items', 30), ('experiences', 40), ('interviews', 50)
  ) as targets(name, base) loop
    perform pg_temp.expect_error(format('update public.%I set cover_letter_id = %L where id = %L',
      target.name, pg_temp.fixture_id(10 + peer), pg_temp.fixture_id(target.base + actor)), '42501');
  end loop;
  perform pg_temp.expect_error(format(
    'insert into public.interview_questions (interview_id, type, order_index, question_text) values (%L, ''main'', 0, ''x'')',
    pg_temp.fixture_id(50 + peer)), '42501');
  perform pg_temp.expect_error(format(
    'update public.interview_questions set interview_id = %L where id = %L',
    pg_temp.fixture_id(50 + peer), pg_temp.fixture_id(70 + actor)), '42501');

  -- Parent UUIDs bypass RLS during FK checks: the composite FK must still reject them.
  foreach peer_id in array array[pg_temp.fixture_id(70 + peer), pg_temp.fixture_id(90 + actor)] loop
    perform pg_temp.expect_error(format(
      'insert into public.interview_questions (interview_id, type, parent_question_id, order_index, question_text) values (%L, ''follow_up'', %L, 1, ''x'')',
      pg_temp.fixture_id(50 + actor), peer_id), '23503');
    perform pg_temp.expect_error(format(
      'update public.interview_questions set parent_question_id = %L where id = %L',
      peer_id, pg_temp.fixture_id(80 + actor)), '23503');
  end loop;
  perform pg_temp.expect_error(format(
    'update public.interview_questions set interview_id = %L where id = %L',
    pg_temp.fixture_id(60 + actor), pg_temp.fixture_id(70 + actor)), '23503');
  perform pg_temp.expect_error(format(
    'update public.interview_questions set interview_id = %L where id = %L',
    pg_temp.fixture_id(60 + actor), pg_temp.fixture_id(80 + actor)), '23503');

  -- Required data, legal status/order/time, and question parent shape.
  perform pg_temp.expect_error(format(
    'insert into public.cover_letters (user_id, company_name) values (%L, ''x'')',
    pg_temp.fixture_id(actor)), '23502');
  perform pg_temp.expect_error(format(
    'update public.essay_items set position = -1 where id = %L', pg_temp.fixture_id(30 + actor)), '23514');
  perform pg_temp.expect_error(format(
    'update public.experiences set position = -1 where id = %L', pg_temp.fixture_id(40 + actor)), '23514');
  perform pg_temp.expect_error(format(
    'update public.interviews set status = ''unknown'' where id = %L', pg_temp.fixture_id(50 + actor)), '23514');
  perform pg_temp.expect_error(format(
    'update public.interviews set duration_seconds = -1 where id = %L', pg_temp.fixture_id(50 + actor)), '23514');
  perform pg_temp.expect_error(format(
    'update public.interviews set ended_at = started_at - interval ''1 second'' where id = %L',
    pg_temp.fixture_id(50 + actor)), '23514');
  perform pg_temp.expect_error(format(
    'update public.interview_questions set order_index = -1 where id = %L', pg_temp.fixture_id(70 + actor)), '23514');
  perform pg_temp.expect_error(format(
    'update public.interview_questions set type = ''unknown'' where id = %L', pg_temp.fixture_id(70 + actor)), '23514');
  perform pg_temp.expect_error(format(
    'update public.interview_questions set parent_question_id = %L where id = %L',
    pg_temp.fixture_id(80 + actor), pg_temp.fixture_id(70 + actor)), '23514');
  perform pg_temp.expect_error(format(
    'update public.interview_questions set parent_question_id = null where id = %L',
    pg_temp.fixture_id(80 + actor)), '23514');
  perform pg_temp.expect_error(format(
    'update public.interview_questions set parent_question_id = id where id = %L',
    pg_temp.fixture_id(80 + actor)), '23514');

  -- Positive reparenting within one's own data remains possible.
  update public.essay_items set cover_letter_id = pg_temp.fixture_id(20 + actor)
    where id = pg_temp.fixture_id(30 + actor);
  update public.essay_items set cover_letter_id = pg_temp.fixture_id(10 + actor)
    where id = pg_temp.fixture_id(30 + actor);
  perform pg_temp.expect_rows(format(
    'select id from public.cover_letters where id = %L and updated_at > ''2000-01-01''',
    pg_temp.fixture_id(10 + actor)), 1);

  update public.interviews
    set status = 'completed', duration_seconds = 120, ended_at = started_at + interval '120 seconds'
    where id = pg_temp.fixture_id(50 + actor);
  update public.interview_questions set answer_transcript = '테스트 답변',
    asked_at = now(), answered_at = now() where id = pg_temp.fixture_id(70 + actor);
  perform pg_temp.expect_rows(format(
    'select id from public.interviews where id = %L and status = ''completed'' and recording_path is null and duration_seconds = 120',
    pg_temp.fixture_id(50 + actor)), 1);
  perform pg_temp.expect_rows(format(
    'select id from public.interview_questions where id = %L and answer_audio_path is null and answer_transcript = ''테스트 답변''',
    pg_temp.fixture_id(70 + actor)), 1);
  raise notice 'PASS: account % CRUD isolation, FK attacks, constraints, recording-free results', actor;
end;
$$;

create function pg_temp.delete_owner(actor integer) returns void language plpgsql as $$
declare target record;
begin
  -- Deleting a parent question also deletes its follow-up.
  perform pg_temp.expect_rows(format('delete from public.interview_questions where id = %L',
    pg_temp.fixture_id(70 + actor)), 1);
  perform pg_temp.expect_rows(format('select * from public.interview_questions where id = %L',
    pg_temp.fixture_id(80 + actor)), 0);
  for target in select * from (values
    ('interviews', 50), ('essay_items', 30), ('experiences', 40), ('cover_letters', 10)
  ) as targets(name, base) loop
    perform pg_temp.expect_rows(format('delete from public.%I where id = %L',
      target.name, pg_temp.fixture_id(target.base + actor)), 1);
  end loop;
  -- Cover-letter deletion cascades through a second interview and its question.
  perform pg_temp.expect_rows(format('delete from public.cover_letters where id = %L',
    pg_temp.fixture_id(20 + actor)), 1);
  perform pg_temp.expect_rows(format('select * from public.interviews where id = %L',
    pg_temp.fixture_id(60 + actor)), 0);
  perform pg_temp.expect_rows(format('select * from public.interview_questions where id = %L',
    pg_temp.fixture_id(90 + actor)), 0);
  raise notice 'PASS: account % own DELETE and cascades', actor;
end;
$$;

-- The bootstrap is optional; a real Supabase project's auth.users works here too.
insert into auth.users (id) values (pg_temp.fixture_id(1)), (pg_temp.fixture_id(2));
select pg_temp.expect_rows($q$
  select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relrowsecurity
    and c.relname in ('cover_letters', 'essay_items', 'experiences', 'interviews', 'interview_questions')
$q$, 5);

set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object('sub', pg_temp.fixture_id(1), 'role', 'authenticated')::text, true);
select pg_temp.seed_owner(1);
reset role;
set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object('sub', pg_temp.fixture_id(2), 'role', 'authenticated')::text, true);
select pg_temp.seed_owner(2);
select pg_temp.check_owner(2);
reset role;
set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object('sub', pg_temp.fixture_id(1), 'role', 'authenticated')::text, true);
select pg_temp.check_owner(1);
reset role;

set local role anon;
select set_config('request.jwt.claims', '{}', true);
do $$
declare target text;
begin
  if auth.uid() is not null then raise exception 'Expected no anon JWT subject'; end if;
  foreach target in array array['cover_letters', 'essay_items', 'experiences', 'interviews', 'interview_questions'] loop
    perform pg_temp.expect_error(format('select * from public.%I', target), '42501');
    perform pg_temp.expect_error(format('insert into public.%I default values', target), '42501');
    perform pg_temp.expect_error(format('update public.%I set id = id', target), '42501');
    perform pg_temp.expect_error(format('delete from public.%I', target), '42501');
    perform pg_temp.expect_error(format('truncate public.%I cascade', target), '42501');
  end loop;
  raise notice 'PASS: anon CRUD and TRUNCATE denied on every table';
end;
$$;
reset role;

-- Authenticated role without a subject must also see/modify nothing via RLS.
set local role authenticated;
do $$
declare target text;
begin
  foreach target in array array['cover_letters', 'essay_items', 'experiences', 'interviews', 'interview_questions'] loop
    perform pg_temp.expect_rows(format('select * from public.%I', target), 0);
    perform pg_temp.expect_rows(format('update public.%I set id = id', target), 0);
    perform pg_temp.expect_rows(format('delete from public.%I', target), 0);
  end loop;
  perform pg_temp.expect_error(format(
    'insert into public.cover_letters (user_id, company_name, job_title) values (%L, ''x'', ''x'')',
    pg_temp.fixture_id(1)), '42501');
end;
$$;
reset role;

-- Both owners' fixtures must still exist after all forbidden writes/deletes.
select pg_temp.expect_rows('select * from public.cover_letters where id in (pg_temp.fixture_id(11), pg_temp.fixture_id(12))', 2);
set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object('sub', pg_temp.fixture_id(1), 'role', 'authenticated')::text, true);
select pg_temp.delete_owner(1);
reset role;
set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object('sub', pg_temp.fixture_id(2), 'role', 'authenticated')::text, true);
select pg_temp.delete_owner(2);
reset role;

rollback;
