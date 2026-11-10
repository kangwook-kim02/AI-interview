-- Run as postgres on a disposable DB with bootstrap and all migrations applied.
begin;
insert into auth.users(id) values ('c0180000-0000-4000-8000-000000000001'), ('c0180000-0000-4000-8000-000000000002');
insert into public.cover_letters(id,user_id,company_name,job_title) values
  ('c0180000-0000-4000-8000-000000000011','c0180000-0000-4000-8000-000000000001','회사','직무');
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
do $$ begin
  if has_function_privilege('anon','public.finish_interview(uuid,uuid,text,jsonb)','execute')
    or has_function_privilege('anon','public.save_interview_answer(uuid,uuid,uuid,text)','execute')
    or exists (select 1 from pg_proc where oid in (
      'public.finish_interview(uuid,uuid,text,jsonb)'::regprocedure,
      'public.save_interview_answer(uuid,uuid,uuid,text)'::regprocedure) and prosecdef) then
    raise exception 'Invalid function privileges';
  end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','c0180000-0000-4000-8000-000000000001',true);
do $$
declare
  sid uuid; other_sid uuid; q uuid; q2 uuid; child uuid; stamp timestamptz; ended jsonb; replay jsonb;
begin
  sid := public.create_interview('c0180000-0000-4000-8000-000000000011',auth.uid(),'["a","b","c","d"]');
  other_sid := public.create_interview('c0180000-0000-4000-8000-000000000011',auth.uid(),'["e","f","g","h"]');
  select id into q from public.interview_questions where interview_id=sid and order_index=0;
  select id into q2 from public.interview_questions where interview_id=other_sid and order_index=0;
  perform set_config('issue18.sid',sid::text,true);
  perform set_config('issue18.q',q::text,true);
  perform pg_temp.expect_error(format('select public.save_interview_answer(%L,%L,%L,%L)',sid,q,
    'c0180000-0000-4000-8000-000000000002','a'),'42501');
  perform pg_temp.expect_error(format('select public.save_interview_answer(%L,%L,auth.uid(),%L)',sid,q2,'a'),'P0002');
  perform pg_temp.expect_error(format('select public.finish_interview(%L,auth.uid(),%L,%L)',sid,'completed','[]'),'P0011');
  perform pg_temp.expect_error(format('update public.interviews set status=%L where id=%L','completed',sid),'23514');
  perform pg_temp.expect_error(format('select public.save_interview_answer(%L,%L,auth.uid(),null)',sid,q),'22023');
  perform pg_temp.expect_error(format('select public.save_interview_answer(%L,%L,auth.uid(),%L)',sid,q,repeat('x',20001)),'22023');
  perform public.save_interview_answer(sid,q,auth.uid(),'답변');
  perform pg_temp.expect_error(format('update public.interview_questions set answer_transcript=%L where id=%L','직접 덮어쓰기',q),'23514');
  select answered_at into stamp from public.interview_questions where id=q;
  perform public.save_interview_answer(sid,q,auth.uid(),'답변');
  if stamp is null or (select answered_at from public.interview_questions where id=q) <> stamp then
    raise exception 'Answer timestamp changed'; end if;
  perform pg_temp.expect_error(format('select public.save_interview_answer(%L,%L,auth.uid(),%L)',sid,q,'다른 답변'),'P0011');
  -- Even the original decision RPC cannot write an inconsistent answer or leave a child behind.
  perform pg_temp.expect_error(format('select public.save_interview_follow_up(%L,%L,auth.uid(),%L,%L)',sid,q,'다른 답변','잘못된 꼬리'),'P0011');
  if exists(select 1 from public.interview_questions where interview_id=sid and type='follow_up') then
    raise exception 'Inconsistent decision left a child'; end if;
  perform public.save_interview_follow_up(sid,q,auth.uid(),'답변','꼬리');
  select id into child from public.interview_questions where parent_question_id=q;
  perform public.save_interview_follow_up(sid,child,auth.uid(),'꼬리 답변',null);
  if not exists(select 1 from public.interview_questions where id=child and answer_transcript='꼬리 답변'
    and answered_at is not null and parent_question_id=q and order_index=0) then
    raise exception 'Missing child answer'; end if;
  for q in select id from public.interview_questions where interview_id=sid and type='main' and order_index>0 loop
    perform public.save_interview_follow_up(sid,q,auth.uid(),'',null);
  end loop;
  ended := public.finish_interview(sid,auth.uid(),'completed','[]');
  perform pg_sleep(0.02);
  replay := public.finish_interview(sid,auth.uid(),'completed','[]');
  if ended <> replay or ended->>'status' <> 'completed'
    or (ended->>'durationSeconds')::int <> (select floor(extract(epoch from ended_at-started_at))::int from public.interviews where id=sid)
    or not exists(select 1 from public.interviews where id=sid and ended_at is not null and recording_path is null) then
    raise exception 'End metadata changed or invalid'; end if;
  perform pg_temp.expect_error(format('update public.interviews set duration_seconds=12345 where id=%L',sid),'23514');
  perform pg_temp.expect_error(format('update public.interviews set status=%L where id=%L','in_progress',sid),'23514');
  perform pg_temp.expect_error(format('update public.interviews set started_at=started_at-interval %L where id=%L','1 hour',sid),'23514');
  perform pg_temp.expect_error(format('update public.interview_questions set answer_transcript=%L where id=%L','변경',child),'23514');
  perform pg_temp.expect_error(format('insert into public.interview_questions(interview_id,type,order_index,question_text) values(%L,%L,0,%L)',sid,'main','늦은 질문'),'23514');
  perform pg_temp.expect_error(format('select public.finish_interview(%L,auth.uid(),%L,%L)',sid,'aborted','[]'),'P0011');
  perform pg_temp.expect_error(format('select public.save_interview_follow_up(%L,%L,auth.uid(),%L,null)',sid,child,'꼬리 답변'),'P0010');

  -- Completion/invalid input failures roll back all submitted answers.
  perform pg_temp.expect_error(format('select public.finish_interview(%L,auth.uid(),%L,%L)',other_sid,'completed',
    jsonb_build_array(jsonb_build_object('questionId',q2,'answerTranscript','미완료'))),'P0011');
  if exists(select 1 from public.interview_questions where id=q2 and answer_transcript is not null) then
    raise exception 'Failed completion partially saved'; end if;
  perform pg_temp.expect_error(format('select public.finish_interview(%L,auth.uid(),%L,%L)',other_sid,'aborted',
    jsonb_build_array(jsonb_build_object('questionId',q2,'answerTranscript','롤백'),
      jsonb_build_object('questionId',child,'answerTranscript','타 면접'))),'P0002');
  if exists(select 1 from public.interview_questions where id=q2 and answer_transcript is not null) then
    raise exception 'Invalid question partially saved'; end if;
  perform pg_temp.expect_error(format('select public.finish_interview(%L,auth.uid(),%L,%L)',other_sid,'aborted',
    jsonb_build_array(jsonb_build_object('questionId',q2,'answerTranscript','a'),
      jsonb_build_object('questionId',q2,'answerTranscript','a'))),'22023');
  ended := public.finish_interview(other_sid,auth.uid(),'aborted',
    jsonb_build_array(jsonb_build_object('questionId',q2,'answerTranscript','종료 직전 확정')));
  replay := public.finish_interview(other_sid,auth.uid(),'aborted',
    jsonb_build_array(jsonb_build_object('questionId',q2,'answerTranscript','종료 직전 확정')));
  if ended <> replay or (select answer_transcript from public.interview_questions where id=q2) <> '종료 직전 확정' then
    raise exception 'Abort answer/replay failed'; end if;
  perform pg_temp.expect_error(format('select public.finish_interview(%L,auth.uid(),%L,%L)',other_sid,'aborted',
    jsonb_build_array(jsonb_build_object('questionId',q2,'answerTranscript','바꾼 답변'))),'P0011');
  select id into q from public.interview_questions where interview_id=other_sid and order_index=1;
  perform pg_temp.expect_error(format('select public.save_interview_answer(%L,%L,auth.uid(),%L)',other_sid,q,'새 답변'),'P0010');
  -- A no-answer abort needs neither an audio nor a video path.
  other_sid := public.create_interview('c0180000-0000-4000-8000-000000000011',auth.uid(),'["a","b","c","d"]');
  perform public.finish_interview(other_sid,auth.uid(),'aborted','[]');
  raise notice 'PASS: answer/empty/parent/order, replay, conflict, complete/abort, timestamps, rollback, no files';
end $$;
select set_config('request.jwt.claim.sub','c0180000-0000-4000-8000-000000000002',true);
select pg_temp.expect_error(format('select public.finish_interview(%L,auth.uid(),%L,%L)',current_setting('issue18.sid'),'aborted','[]'),'P0002');
select pg_temp.expect_error(format('select public.save_interview_answer(%L,%L,auth.uid(),%L)',current_setting('issue18.sid'),current_setting('issue18.q'),'a'),'P0002');
select set_config('request.jwt.claim.sub','',true);
select pg_temp.expect_error(format('select public.finish_interview(%L,null,%L,%L)',current_setting('issue18.sid'),'aborted','[]'),'42501');
set local role anon;
select pg_temp.expect_error(format('select public.finish_interview(%L,null,%L,%L)',current_setting('issue18.sid'),'aborted','[]'),'42501');
rollback;
