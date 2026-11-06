-- Run on a disposable migrated DB as postgres. All fixtures roll back.
begin;
insert into auth.users (id) values
  ('c0070000-0000-4000-8000-000000000001'),
  ('c0070000-0000-4000-8000-000000000002');

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

-- Inject a real child-write failure after the parent and essays were inserted.
create function pg_temp.reject_test_experience() returns trigger language plpgsql as $$
begin
  if new.content = '__fail_child__' then
    raise exception 'Injected child failure' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger issue7_fail_child before insert on public.experiences
for each row execute function pg_temp.reject_test_experience();

set local role anon;
select pg_temp.expect_error($q$select public.create_cover_letter(
  'c0070000-0000-4000-8000-000000000001', '회사', '직무',
  '[{"question":"질문","answer":"답변"}]', '[]')$q$, '42501');

set local role authenticated;
select set_config('request.jwt.claim.sub', '', true);
select pg_temp.expect_error($q$select public.create_cover_letter(
  'c0070000-0000-4000-8000-000000000001', '회사', '직무',
  '[{"question":"질문","answer":"답변"}]', '[]')$q$, '42501');

select set_config('request.jwt.claim.sub', 'c0070000-0000-4000-8000-000000000001', true);
select pg_temp.expect_error($q$select public.create_cover_letter(
  'c0070000-0000-4000-8000-000000000002', '회사', '직무',
  '[{"question":"질문","answer":"답변"}]', '[]')$q$, '42501');

do $$
declare
  cover_id uuid;
  empty_id uuid;
  statements text[] := array[
    $q$select public.create_cover_letter(auth.uid(), ' ', '직무', '[{"question":"질문","answer":"답변"}]', '[]')$q$,
    $q$select public.create_cover_letter(auth.uid(), '회사', null, '[{"question":"질문","answer":"답변"}]', '[]')$q$,
    $q$select public.create_cover_letter(auth.uid(), '회사', '직무', '[]', '[]')$q$,
    $q$select public.create_cover_letter(auth.uid(), '회사', '직무', '{}', '[]')$q$,
    $q$select public.create_cover_letter(auth.uid(), '회사', '직무', null, '[]')$q$,
    $q$select public.create_cover_letter(auth.uid(), '회사', '직무', '[{"question":"질문"}]', '[]')$q$,
    $q$select public.create_cover_letter(auth.uid(), '회사', '직무', '[{"question":123,"answer":"답변"}]', '[]')$q$,
    $q$select public.create_cover_letter(auth.uid(), '회사', '직무', '[{"question":"질문","answer":" "}]', '[]')$q$,
    $q$select public.create_cover_letter(auth.uid(), '회사', '직무', '[{"question":"질문","answer":"답변"}]', '[{}]')$q$
  ];
  statement text;
begin
  foreach statement in array statements loop
    perform pg_temp.expect_error(statement, '22023');
  end loop;

  perform pg_temp.expect_error($q$select public.create_cover_letter(auth.uid(), '롤백회사', '직무',
    '[{"question":"질문","answer":"답변"}]', '[{"content":"정상경험"},{"content":"__fail_child__"}]')$q$, '23514');
  if exists(select 1 from public.cover_letters)
    or exists(select 1 from public.essay_items)
    or exists(select 1 from public.experiences) then
    raise exception 'Partial rows survived validation or child failure';
  end if;

  cover_id := public.create_cover_letter(auth.uid(), ' 회사 ', ' 직무 ',
    '[{"question":"질문2","answer":"답변2"},{"question":"질문1","answer":"답변1"}]',
    '[{"content":"경험2"},{"content":"경험1"}]');
  if not exists(select 1 from public.cover_letters where id = cover_id
    and user_id = auth.uid() and company_name = '회사' and job_title = '직무') then
    raise exception 'Wrong owner or company';
  end if;
  if (select array_agg(question order by position) from public.essay_items where cover_letter_id = cover_id)
    <> array['질문2', '질문1']
    or (select array_agg(position order by position) from public.essay_items where cover_letter_id = cover_id)
    <> array[0, 1] then
    raise exception 'Essay order not preserved';
  end if;
  if (select array_agg(content order by position) from public.experiences where cover_letter_id = cover_id)
    <> array['경험2', '경험1'] then
    raise exception 'Experience order not preserved';
  end if;
  empty_id := public.create_cover_letter(auth.uid(), '경험없음', '직무',
    '[{"question":"질문","answer":"답변"}]', '[]');
  if exists(select 1 from public.experiences where cover_letter_id = empty_id) then
    raise exception 'Zero experiences not respected';
  end if;
  raise notice 'PASS: RPC validation, verified owner, order, zero experiences, child-failure rollback';
end;
$$;

select set_config('request.jwt.claim.sub', 'c0070000-0000-4000-8000-000000000002', true);
do $$
begin
  if exists(select 1 from public.cover_letters)
    or exists(select 1 from public.essay_items)
    or exists(select 1 from public.experiences) then
    raise exception 'Peer account can read RPC-created data';
  end if;
  raise notice 'PASS: RPC-created data is isolated from peer account';
end;
$$;
rollback;
