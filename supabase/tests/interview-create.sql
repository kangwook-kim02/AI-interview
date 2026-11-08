-- Run on a disposable migrated DB as postgres. All fixtures and triggers roll back.
begin;
insert into auth.users (id) values
  ('c0120000-0000-4000-8000-000000000001'),
  ('c0120000-0000-4000-8000-000000000002');
insert into public.cover_letters (id, user_id, company_name, job_title) values
  ('c0120000-0000-4000-8000-000000000011', 'c0120000-0000-4000-8000-000000000001', '회사A', '직무A'),
  ('c0120000-0000-4000-8000-000000000012', 'c0120000-0000-4000-8000-000000000002', '회사B', '직무B');

create function pg_temp.expect_error(statement text, expected_state text) returns void
language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if sqlstate = expected_state then return; end if;
    raise exception 'Expected %, got %: %', expected_state, sqlstate, sqlerrm;
  end;
  raise exception 'Expected error %, statement succeeded', expected_state;
end;
$$;

create function pg_temp.reject_test_question() returns trigger language plpgsql as $$
begin
  if new.question_text = '__fail_question__' then
    raise exception 'Injected question failure' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger issue12_fail_question before insert on public.interview_questions
for each row execute function pg_temp.reject_test_question();

do $$
begin
  if has_function_privilege('anon', 'public.create_interview(uuid,uuid,jsonb)', 'execute')
    or not has_function_privilege('authenticated', 'public.create_interview(uuid,uuid,jsonb)', 'execute')
    or (select prosecdef from pg_proc where oid = 'public.create_interview(uuid,uuid,jsonb)'::regprocedure) then
    raise exception 'Wrong RPC privileges or SECURITY DEFINER';
  end if;
end;
$$;
set local role anon;
select pg_temp.expect_error($q$select public.create_interview(
  'c0120000-0000-4000-8000-000000000011', 'c0120000-0000-4000-8000-000000000001',
  '["질문1","질문2","질문3","질문4"]')$q$, '42501');
set local role authenticated;
select set_config('request.jwt.claim.sub', '', true);
select pg_temp.expect_error($q$select public.create_interview(
  'c0120000-0000-4000-8000-000000000011', 'c0120000-0000-4000-8000-000000000001',
  '["질문1","질문2","질문3","질문4"]')$q$, '42501');
select set_config('request.jwt.claim.sub', 'c0120000-0000-4000-8000-000000000001', true);
select pg_temp.expect_error($q$select public.create_interview(
  'c0120000-0000-4000-8000-000000000011', 'c0120000-0000-4000-8000-000000000002',
  '["질문1","질문2","질문3","질문4"]')$q$, '42501');

do $$
declare
  invalid_input jsonb;
  first_id uuid;
  second_id uuid;
  first_question_ids uuid[];
  before_interviews bigint;
  before_questions bigint;
begin
  perform pg_temp.expect_error($q$select public.create_interview(
    'c0120000-0000-4000-8000-000000000012', auth.uid(), '["a","b","c","d"]')$q$, 'P0002');
  perform pg_temp.expect_error($q$select public.create_interview(
    'c0120000-0000-4000-8000-000000000099', auth.uid(), '["a","b","c","d"]')$q$, 'P0002');
  perform pg_temp.expect_error($q$select public.create_interview(
    null, auth.uid(), '["a","b","c","d"]')$q$, 'P0002');

  foreach invalid_input in array array[
    null, 'null'::jsonb, '{}'::jsonb, '[]'::jsonb, '["a","b","c"]'::jsonb,
    '["a","b","c","d","e"]'::jsonb, '["a",null,"c","d"]'::jsonb,
    '["a",1,"c","d"]'::jsonb, '["a",{},"c","d"]'::jsonb,
    '["a","","c","d"]'::jsonb, '["a"," \t\n ","c","d"]'::jsonb
  ] loop
    perform pg_temp.expect_error(format($q$select public.create_interview(
      'c0120000-0000-4000-8000-000000000011', auth.uid(), %L::jsonb)$q$, invalid_input), '22023');
  end loop;
  if exists(select 1 from public.interviews) or exists(select 1 from public.interview_questions) then
    raise exception 'Validation or ownership failure created rows';
  end if;

  first_id := public.create_interview('c0120000-0000-4000-8000-000000000011', auth.uid(),
    '[" 질문2 ","질문1","질문4","질문3"]');
  if not exists(select 1 from public.interviews where id = first_id and user_id = auth.uid()
    and cover_letter_id = 'c0120000-0000-4000-8000-000000000011' and status = 'in_progress'
    and ended_at is null and recording_path is null) then
    raise exception 'Wrong session ownership, card, or initial status';
  end if;
  if (select array_agg(question_text order by order_index) from public.interview_questions where interview_id = first_id)
      is distinct from array['질문2','질문1','질문4','질문3']
    or (select array_agg(order_index order by order_index) from public.interview_questions where interview_id = first_id)
      is distinct from array[0,1,2,3]
    or exists(select 1 from public.interview_questions where interview_id = first_id
      and (type <> 'main' or parent_question_id is not null or asked_at is not null)) then
    raise exception 'Question count, ordering, type, or parent incorrect';
  end if;
  select array_agg(id order by order_index) into first_question_ids
    from public.interview_questions where interview_id = first_id;
  update public.interview_questions set answer_transcript = '기존 답변'
    where interview_id = first_id and order_index = 0;
  second_id := public.create_interview('c0120000-0000-4000-8000-000000000011', auth.uid(),
    '["새질문1","새질문2","새질문3","새질문4"]');
  if first_id = second_id or (select count(*) from public.interviews) <> 2
    or (select count(*) from public.interview_questions) <> 8
    or (select array_agg(id order by order_index) from public.interview_questions where interview_id = first_id)
      is distinct from first_question_ids
    or (select answer_transcript from public.interview_questions where interview_id = first_id and order_index = 0)
      is distinct from '기존 답변' then
    raise exception 'Retake overwrote the original session';
  end if;

  select count(*) into before_interviews from public.interviews;
  select count(*) into before_questions from public.interview_questions;
  perform pg_temp.expect_error($q$select public.create_interview(
    'c0120000-0000-4000-8000-000000000011', auth.uid(),
    '["정상질문","__fail_question__","질문3","질문4"]')$q$, '23514');
  if (select count(*) from public.interviews) <> before_interviews
    or (select count(*) from public.interview_questions) <> before_questions then
    raise exception 'Partial session or questions survived child INSERT failure';
  end if;
  perform set_config('issue12.first_id', first_id::text, true);
  raise notice 'PASS: validation, ownership, question order/type, independent retake, atomic rollback';
end;
$$;

select set_config('request.jwt.claim.sub', 'c0120000-0000-4000-8000-000000000002', true);
do $$
declare
  peer_id uuid;
begin
  if exists(select 1 from public.interviews) or exists(select 1 from public.interview_questions) then
    raise exception 'Peer can read another owner session/questions';
  end if;
  perform pg_temp.expect_error($q$select public.create_interview(
    'c0120000-0000-4000-8000-000000000011', auth.uid(), '["a","b","c","d"]')$q$, 'P0002');
  peer_id := public.create_interview('c0120000-0000-4000-8000-000000000012', auth.uid(), '["a","b","c","d"]');
  if (select count(*) from public.interviews) <> 1 or (select count(*) from public.interview_questions) <> 4 then
    raise exception 'Peer own RPC failed or reads foreign rows';
  end if;
  raise notice 'PASS: peer isolation and own session creation';
end;
$$;
set local role anon;
select pg_temp.expect_error('select * from public.interviews', '42501');
select pg_temp.expect_error('select * from public.interview_questions', '42501');
rollback;
