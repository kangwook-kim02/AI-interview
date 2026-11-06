-- Run on a disposable migrated DB as postgres. Every fixture is rolled back.
begin;
insert into auth.users (id) values
  ('c0090000-0000-4000-8000-000000000001'),
  ('c0090000-0000-4000-8000-000000000002');
insert into public.cover_letters (id, user_id, company_name, job_title) values
  ('c0090000-0000-4000-8000-000000000011', 'c0090000-0000-4000-8000-000000000001', '원본회사', '원본직무'),
  ('c0090000-0000-4000-8000-000000000012', 'c0090000-0000-4000-8000-000000000002', '타인회사', '타인직무');
insert into public.essay_items (cover_letter_id, question, answer) values
  ('c0090000-0000-4000-8000-000000000011', '원본질문', '원본답변'),
  ('c0090000-0000-4000-8000-000000000012', '타인질문', '타인답변');
insert into public.experiences (cover_letter_id, content) values
  ('c0090000-0000-4000-8000-000000000011', '원본경험'),
  ('c0090000-0000-4000-8000-000000000012', '타인경험');
insert into public.interviews (id, cover_letter_id, user_id) values
  ('c0090000-0000-4000-8000-000000000021', 'c0090000-0000-4000-8000-000000000011', 'c0090000-0000-4000-8000-000000000001');
insert into public.interview_questions (id, interview_id, type, order_index, question_text) values
  ('c0090000-0000-4000-8000-000000000031', 'c0090000-0000-4000-8000-000000000021', 'main', 0, '면접질문');
insert into public.interview_questions (interview_id, type, parent_question_id, order_index, question_text) values
  ('c0090000-0000-4000-8000-000000000021', 'follow_up', 'c0090000-0000-4000-8000-000000000031', 0, '꼬리질문');

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
create function pg_temp.reject_test_experience() returns trigger language plpgsql as $$
begin
  if new.content = '__fail_child__' then
    raise exception 'Injected child failure' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger issue9_fail_child before insert on public.experiences
for each row execute function pg_temp.reject_test_experience();

set local role anon;
select pg_temp.expect_error($q$select public.update_cover_letter(
  'c0090000-0000-4000-8000-000000000011', 'c0090000-0000-4000-8000-000000000001',
  '회사', '직무', '[{"question":"질문","answer":"답변"}]', '[]')$q$, '42501');
select pg_temp.expect_error($q$delete from public.cover_letters where id = 'c0090000-0000-4000-8000-000000000011'$q$, '42501');

set local role authenticated;
select set_config('request.jwt.claim.sub', '', true);
select pg_temp.expect_error($q$select public.update_cover_letter(
  'c0090000-0000-4000-8000-000000000011', 'c0090000-0000-4000-8000-000000000001',
  '회사', '직무', '[{"question":"질문","answer":"답변"}]', '[]')$q$, '42501');
select set_config('request.jwt.claim.sub', 'c0090000-0000-4000-8000-000000000001', true);
select pg_temp.expect_error($q$select public.update_cover_letter(
  'c0090000-0000-4000-8000-000000000011', 'c0090000-0000-4000-8000-000000000002',
  '회사', '직무', '[{"question":"질문","answer":"답변"}]', '[]')$q$, '42501');
select pg_temp.expect_error($q$select public.update_cover_letter(
  'c0090000-0000-4000-8000-000000000012', auth.uid(),
  '회사', '직무', '[{"question":"질문","answer":"답변"}]', '[]')$q$, 'P0002');
select pg_temp.expect_error($q$select public.update_cover_letter(
  'c0090000-0000-4000-8000-000000000099', auth.uid(),
  '회사', '직무', '[{"question":"질문","answer":"답변"}]', '[]')$q$, 'P0002');

do $$
declare
  cover_id uuid := 'c0090000-0000-4000-8000-000000000011';
  parent_before jsonb;
  essays_before jsonb;
  experiences_before jsonb;
  invalid_input text;
begin
  select to_jsonb(cl) into parent_before from public.cover_letters cl where id = cover_id;
  select jsonb_agg(to_jsonb(e) order by id) into essays_before from public.essay_items e where cover_letter_id = cover_id;
  select jsonb_agg(to_jsonb(e) order by id) into experiences_before from public.experiences e where cover_letter_id = cover_id;
  foreach invalid_input in array array[
    $q$' ', '직무', '[{"question":"질문","answer":"답변"}]', '[]'$q$,
    $q$'회사', null, '[{"question":"질문","answer":"답변"}]', '[]'$q$,
    $q$'회사', '직무', '[]', '[]'$q$,
    $q$'회사', '직무', '{}', '[]'$q$,
    $q$'회사', '직무', null, '[]'$q$,
    $q$'회사', '직무', '[{"question":"질문"}]', '[]'$q$,
    $q$'회사', '직무', '[{"question":123,"answer":"답변"}]', '[]'$q$,
    $q$'회사', '직무', '[{"question":"질문","answer":" "}]', '[]'$q$,
    $q$'회사', '직무', '[{"question":"질문","answer":"답변"}]', '[{}]'$q$
  ] loop
    perform pg_temp.expect_error(format('select public.update_cover_letter(%L, auth.uid(), %s)', cover_id, invalid_input), '22023');
  end loop;
  -- Fails after parent UPDATE, child DELETEs and new essay INSERTs.
  perform pg_temp.expect_error(format($q$select public.update_cover_letter(%L, auth.uid(), '바뀌면안됨', '직무',
    '[{"question":"새질문","answer":"새답변"}]', '[{"content":"정상"},{"content":"__fail_child__"}]')$q$, cover_id), '23514');
  if (select to_jsonb(cl) from public.cover_letters cl where id = cover_id) is distinct from parent_before
    or (select jsonb_agg(to_jsonb(e) order by id) from public.essay_items e where cover_letter_id = cover_id) is distinct from essays_before
    or (select jsonb_agg(to_jsonb(e) order by id) from public.experiences e where cover_letter_id = cover_id) is distinct from experiences_before then
    raise exception 'Original parent/updated_at/children changed after failure';
  end if;

  perform public.update_cover_letter(cover_id, auth.uid(), ' 수정회사 ', ' 수정직무 ',
    '[{"question":"질문2","answer":"답변2"},{"question":"질문1","answer":"답변1"}]',
    '[{"content":"경험2"},{"content":"경험1"}]');
  if not exists(select 1 from public.cover_letters where id = cover_id and company_name = '수정회사' and job_title = '수정직무')
    or (select array_agg(question order by position) from public.essay_items where cover_letter_id = cover_id) <> array['질문2','질문1']
    or (select array_agg(position order by position) from public.essay_items where cover_letter_id = cover_id) <> array[0,1]
    or (select array_agg(content order by position) from public.experiences where cover_letter_id = cover_id) <> array['경험2','경험1'] then
    raise exception 'Edit fields/order not persisted';
  end if;
  perform public.update_cover_letter(cover_id, auth.uid(), '수정회사', '수정직무',
    '[{"question":"질문1","answer":"답변1"}]', '[]');
  if (select count(*) from public.essay_items where cover_letter_id = cover_id) <> 1
    or exists(select 1 from public.experiences where cover_letter_id = cover_id)
    or (select count(*) from public.interview_questions) <> 2 then
    raise exception 'Child removal or interview preservation failed';
  end if;
  raise notice 'PASS: edit ownership, validation, fields/order, child replacement, zero experiences, full rollback';
end;
$$;

-- Peer delete has no effect. Owner delete cascades through all domain children.
delete from public.cover_letters where id = 'c0090000-0000-4000-8000-000000000012';
delete from public.cover_letters where id = 'c0090000-0000-4000-8000-000000000011' and user_id = auth.uid();
reset role;
do $$
begin
  if exists(select 1 from public.cover_letters where id = 'c0090000-0000-4000-8000-000000000011')
    or exists(select 1 from public.essay_items where cover_letter_id = 'c0090000-0000-4000-8000-000000000011')
    or exists(select 1 from public.experiences where cover_letter_id = 'c0090000-0000-4000-8000-000000000011')
    or exists(select 1 from public.interviews where id = 'c0090000-0000-4000-8000-000000000021')
    or exists(select 1 from public.interview_questions where interview_id = 'c0090000-0000-4000-8000-000000000021') then
    raise exception 'Deleted card or cascade children survived';
  end if;
  if not exists(select 1 from public.cover_letters where id = 'c0090000-0000-4000-8000-000000000012' and company_name = '타인회사')
    or not exists(select 1 from public.essay_items where cover_letter_id = 'c0090000-0000-4000-8000-000000000012' and answer = '타인답변')
    or not exists(select 1 from public.experiences where cover_letter_id = 'c0090000-0000-4000-8000-000000000012' and content = '타인경험') then
    raise exception 'Peer data changed';
  end if;
  raise notice 'PASS: owner DELETE cascades; peer DELETE and edits leave peer data intact';
end;
$$;
rollback;
