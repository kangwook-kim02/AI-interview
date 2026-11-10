-- Run on a disposable migrated DB as postgres. All fixtures/triggers roll back.
begin;
insert into auth.users(id) values
 ('c0150000-0000-4000-8000-000000000001'), ('c0150000-0000-4000-8000-000000000002');
insert into public.cover_letters(id,user_id,company_name,job_title) values
 ('c0150000-0000-4000-8000-000000000011','c0150000-0000-4000-8000-000000000001','회사','직무');

create function pg_temp.expect_error(statement text, expected text) returns void language plpgsql as $$
begin
  begin execute statement;
  exception when others then
    if sqlstate = expected then return; end if;
    raise exception 'Expected %, got %: %', expected, sqlstate, sqlerrm;
  end;
  raise exception 'Expected error %, statement succeeded', expected;
end;
$$;
create function pg_temp.fail_decision() returns trigger language plpgsql as $$
begin
  if new.answer_transcript = '__fail_decision__' then
    raise exception 'Injected decision failure' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger issue15_fail_decision before insert on public.interview_follow_up_decisions
  for each row execute function pg_temp.fail_decision();
do $$
begin
  if has_function_privilege('anon','public.save_interview_follow_up(uuid,uuid,uuid,text,text)','execute')
    or (select prosecdef from pg_proc where oid = 'public.save_interview_follow_up(uuid,uuid,uuid,text,text)'::regprocedure)
    or has_table_privilege('anon', 'public.interview_follow_up_decisions', 'select')
    or has_table_privilege('authenticated', 'public.interview_follow_up_decisions', 'truncate') then
    raise exception 'Wrong privileges or SECURITY DEFINER';
  end if;
end;
$$;
set local role authenticated;
select set_config('request.jwt.claim.sub','c0150000-0000-4000-8000-000000000001',true);
do $$
declare
  sid uuid; sid2 uuid; main_id uuid; first_id uuid; second_id uuid; other_id uuid;
  result jsonb;
begin
  sid := public.create_interview('c0150000-0000-4000-8000-000000000011',auth.uid(),'["a","b","c","d"]');
  sid2 := public.create_interview('c0150000-0000-4000-8000-000000000011',auth.uid(),'["e","f","g","h"]');
  select id into main_id from public.interview_questions where interview_id=sid and order_index=0;
  select id into other_id from public.interview_questions where interview_id=sid2 and order_index=0;
  perform set_config('issue15.sid',sid::text,true);
  perform set_config('issue15.main',main_id::text,true);
  perform pg_temp.expect_error(format('select public.save_interview_follow_up(%L,%L,%L,%L,%L)',sid,main_id,
    'c0150000-0000-4000-8000-000000000002','answer','q'),'42501');
  perform pg_temp.expect_error(format('select public.save_interview_follow_up(%L,%L,auth.uid(),%L,%L)',sid,other_id,'answer','q'),'P0002');
  perform pg_temp.expect_error(format('select public.save_interview_follow_up(%L,%L,auth.uid(),null,%L)',sid,main_id,'q'),'22023');
  perform pg_temp.expect_error(format('select public.save_interview_follow_up(%L,%L,auth.uid(),%L,%L)',sid,main_id,'answer',E' \t\n'),'22023');
  perform pg_temp.expect_error(format('select public.save_interview_follow_up(%L,%L,auth.uid(),%L,%L)',sid,main_id,repeat('x',20001),'q'),'22023');

  -- Inject failure after question INSERT. The question must roll back too.
  perform pg_temp.expect_error(format('select public.save_interview_follow_up(%L,%L,auth.uid(),%L,%L)',sid,main_id,'__fail_decision__','q'),'23514');
  if exists(select 1 from public.interview_questions where interview_id=sid and type='follow_up')
    or exists(select 1 from public.interview_follow_up_decisions) then raise exception 'Partial write survived'; end if;
  result := public.save_interview_follow_up(sid,main_id,auth.uid(),'답변1','첫 질문?');
  if result <> '{"followUp":"첫 질문?"}'::jsonb then raise exception 'Wrong first result'; end if;
  select id into first_id from public.interview_questions where parent_question_id=main_id and order_index=0;
  if first_id is null then raise exception 'Missing first child'; end if;
  if public.save_interview_follow_up(sid,main_id,auth.uid(),'답변1','중복 생성?') <> result then
    raise exception 'Replay did not return committed result'; end if;
  perform pg_temp.expect_error(format('select public.save_interview_follow_up(%L,%L,auth.uid(),%L,%L)',sid,main_id,'바뀐 답변','q'),'P0011');
  perform public.save_interview_follow_up(sid,first_id,auth.uid(),'답변2','두 번째?');
  select id into second_id from public.interview_questions where parent_question_id=main_id and order_index=1;
  if second_id is null then raise exception 'Missing second child'; end if;
  if public.save_interview_follow_up(sid,second_id,auth.uid(),'답변3','상한 초과?') <> '{"followUp":null}'::jsonb
    or (select count(*) from public.interview_questions where parent_question_id=main_id) <> 2 then
    raise exception 'Follow-up cap exceeded'; end if;
  if exists(select 1 from public.interview_questions where interview_id=sid and type='follow_up'
    and (parent_question_id<>main_id or order_index not in (0,1))) then raise exception 'Wrong parent/order'; end if;
  perform pg_temp.expect_error(format($q$insert into public.interview_questions(interview_id,type,parent_question_id,order_index,question_text)
    values(%L,'follow_up',%L,2,'q')$q$,sid,main_id),'23514');
  perform pg_temp.expect_error(format($q$insert into public.interview_questions(interview_id,type,parent_question_id,order_index,question_text)
    values(%L,'follow_up',%L,1,'q')$q$,sid,main_id),'23505');

  -- A source without a decision cannot request another child after one was issued.
  select id into first_id from public.interview_questions where interview_id=sid2 and type='main' and order_index=3;
  insert into public.interview_questions(interview_id,type,parent_question_id,order_index,question_text)
    values(sid2,'follow_up',first_id,0,'이미 제시한 질문');
  perform pg_temp.expect_error(format('select public.save_interview_follow_up(%L,%L,auth.uid(),%L,%L)',sid2,first_id,'답변2','q'),'P0011');

  -- Both deliberate null and empty answers are terminal and idempotent.
  if public.save_interview_follow_up(sid2,other_id,auth.uid(),'답변',null) <> '{"followUp":null}'::jsonb
    or public.save_interview_follow_up(sid2,other_id,auth.uid(),'답변','later') <> '{"followUp":null}'::jsonb then
    raise exception 'Null decision not replayed'; end if;
  select id into other_id from public.interview_questions where interview_id=sid2 and order_index=1;
  if public.save_interview_follow_up(sid2,other_id,auth.uid(),'','guess') <> '{"followUp":null}'::jsonb then
    raise exception 'Empty answer should be null'; end if;
  update public.interviews set status='aborted' where id=sid;
  perform pg_temp.expect_error(format('select public.save_interview_follow_up(%L,%L,auth.uid(),%L,%L)',sid,main_id,'답변1','q'),'P0010');
  update public.interviews set status='aborted' where id=sid2;
  perform pg_temp.expect_error(format('select public.save_interview_follow_up(%L,%L,auth.uid(),%L,%L)',sid2,other_id,'','q'),'P0010');
  raise notice 'PASS: cap, parent/order, replay/null/empty, answer conflicts, stale source, rollback, closed sessions';
end;
$$;
select set_config('request.jwt.claim.sub','c0150000-0000-4000-8000-000000000002',true);
do $$
begin
  if exists(select 1 from public.interview_follow_up_decisions) then raise exception 'Peer decision leak'; end if;
  perform pg_temp.expect_error(format('select public.save_interview_follow_up(%L,%L,auth.uid(),%L,%L)',
    current_setting('issue15.sid'), current_setting('issue15.main'),'answer','q'),'P0002');
end;
$$;
select set_config('request.jwt.claim.sub','',true);
select pg_temp.expect_error(format('select public.save_interview_follow_up(%L,%L,null,%L,%L)',
  current_setting('issue15.sid'),current_setting('issue15.main'),'answer','q'),'42501');
set local role anon;
select pg_temp.expect_error('select * from public.interview_follow_up_decisions','42501');
rollback;
