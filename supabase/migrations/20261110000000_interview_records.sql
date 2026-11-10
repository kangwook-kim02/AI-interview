-- Existing decisions already contain final transcripts. Preserve these on upgrade.
update public.interview_questions q
set answer_transcript = d.answer_transcript, answered_at = coalesce(q.answered_at, statement_timestamp())
from public.interview_follow_up_decisions d
where q.id = d.question_id and q.interview_id = d.interview_id and q.answer_transcript is null;

create function public.save_interview_answer(
  target_interview_id uuid, source_question_id uuid, expected_user_id uuid, answer text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  session_row public.interviews;
  source_row public.interview_questions;
begin
  if auth.uid() is null or expected_user_id is distinct from auth.uid() then
    raise exception 'Owner mismatch' using errcode = '42501';
  end if;
  if answer is null or char_length(answer) > 20000 then
    raise exception 'Invalid answer' using errcode = '22023';
  end if;
  select * into session_row from public.interviews
    where id = target_interview_id and user_id = expected_user_id for update;
  if not found then raise exception 'Interview not found' using errcode = 'P0002'; end if;
  select * into source_row from public.interview_questions
    where id = source_question_id and interview_id = target_interview_id for update;
  if not found then raise exception 'Question not found' using errcode = 'P0002'; end if;
  if source_row.type = 'main' and source_row.order_index not between 0 and 3
    or source_row.type = 'follow_up' and not exists (
      select 1 from public.interview_questions root
      where root.id = source_row.parent_question_id and root.interview_id = target_interview_id
        and root.type = 'main' and root.order_index between 0 and 3
    ) then raise exception 'Invalid position or parent' using errcode = 'P0011'; end if;
  if source_row.answer_transcript is not null then
    if source_row.answer_transcript is distinct from answer then
      raise exception 'Answer conflict' using errcode = 'P0011';
    end if;
    return; -- The original answer and timestamp survive retries, even after ending.
  end if;
  if session_row.status <> 'in_progress' then
    raise exception 'Interview closed' using errcode = 'P0010';
  end if;
  if exists (select 1 from public.interview_follow_up_decisions d
    where d.question_id = source_question_id and d.answer_transcript is distinct from answer) then
    raise exception 'Decision answer conflict' using errcode = 'P0011';
  end if;
  update public.interview_questions
    set answer_transcript = answer, answered_at = clock_timestamp()
    where id = source_question_id and interview_id = target_interview_id;
end;
$$;
revoke all on function public.save_interview_answer(uuid, uuid, uuid, text) from public, anon;
grant execute on function public.save_interview_answer(uuid, uuid, uuid, text) to authenticated;

-- Keep direct uses of the existing decision RPC consistent with the answer store.
create function public.persist_interview_decision_answer()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform public.save_interview_answer(new.interview_id, new.question_id, auth.uid(), new.answer_transcript);
  return new;
end;
$$;
revoke all on function public.persist_interview_decision_answer() from public, anon, authenticated;
create trigger interview_decision_save_answer before insert on public.interview_follow_up_decisions
  for each row execute function public.persist_interview_decision_answer();

create function public.finish_interview(
  target_interview_id uuid, expected_user_id uuid, end_status text, answers jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  session_row public.interviews;
  item jsonb;
  question_id uuid;
  seen uuid[] := '{}';
begin
  if auth.uid() is null or expected_user_id is distinct from auth.uid() then
    raise exception 'Owner mismatch' using errcode = '42501';
  end if;
  if end_status is null or end_status not in ('completed', 'aborted')
    or answers is null or jsonb_typeof(answers) <> 'array' then
    raise exception 'Invalid finish input' using errcode = '22023';
  end if;
  if jsonb_array_length(answers) > 12 then
    raise exception 'Too many answers' using errcode = '22023';
  end if;
  -- Same lock as answer/decision writers. No question may be appended after this commit.
  select * into session_row from public.interviews
    where id = target_interview_id and user_id = expected_user_id for update;
  if not found then raise exception 'Interview not found' using errcode = 'P0002'; end if;
  if session_row.status <> 'in_progress' and session_row.status <> end_status then
    raise exception 'End status conflict' using errcode = 'P0011';
  end if;
  for item in select value from jsonb_array_elements(answers) loop
    if jsonb_typeof(item) <> 'object' or jsonb_typeof(item->'questionId') is distinct from 'string'
      or jsonb_typeof(item->'answerTranscript') is distinct from 'string'
      or (item - 'questionId' - 'answerTranscript') <> '{}'::jsonb then
      raise exception 'Invalid answer entry' using errcode = '22023';
    end if;
    question_id := (item->>'questionId')::uuid;
    if question_id = any(seen) then raise exception 'Duplicate answer' using errcode = '22023'; end if;
    seen := array_append(seen, question_id);
    perform public.save_interview_answer(target_interview_id, question_id, expected_user_id, item->>'answerTranscript');
  end loop;
  if session_row.status = 'in_progress' then
    if end_status = 'completed' and (
      (select count(*) from public.interview_questions where interview_id = target_interview_id and type = 'main') <> 4
      or (select count(distinct order_index) from public.interview_questions
        where interview_id = target_interview_id and type = 'main' and order_index between 0 and 3) <> 4
      or exists (select 1 from public.interview_questions q
        where q.interview_id = target_interview_id and (q.answer_transcript is null
          or not exists (select 1 from public.interview_follow_up_decisions d
            where d.question_id = q.id and d.interview_id = target_interview_id
              and d.answer_transcript = q.answer_transcript)))
    ) then raise exception 'Interview not complete' using errcode = 'P0011'; end if;
    -- The record guard stamps ended_at/duration_seconds using the database clock.
    update public.interviews set status = end_status
      where id = target_interview_id and user_id = expected_user_id
      returning * into session_row;
  end if;
  return jsonb_build_object('interviewId', session_row.id, 'status', session_row.status,
    'endedAt', session_row.ended_at, 'durationSeconds', session_row.duration_seconds);
end;
$$;
revoke all on function public.finish_interview(uuid, uuid, text, jsonb) from public, anon;
grant execute on function public.finish_interview(uuid, uuid, text, jsonb) to authenticated;

-- The publishable API also exposes tables. Preserve terminal records even for direct writes.
create function public.guard_interview_record()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'in_progress' or new.ended_at is not null or new.duration_seconds is not null then
      raise exception 'New interview must be in progress' using errcode = '23514';
    end if;
    new.started_at := clock_timestamp();
    return new;
  end if;
  if new.started_at is distinct from old.started_at then
    raise exception 'Start time is immutable' using errcode = '23514';
  end if;
  if old.status <> 'in_progress' then
    if (new.status, new.ended_at, new.duration_seconds) is distinct from (old.status, old.ended_at, old.duration_seconds) then
      raise exception 'End record is immutable' using errcode = '23514';
    end if;
  elsif new.status <> 'in_progress' then
    if new.status = 'completed' and (
      (select count(*) from public.interview_questions where interview_id = old.id and type = 'main') <> 4
      or (select count(distinct order_index) from public.interview_questions
        where interview_id = old.id and type = 'main' and order_index between 0 and 3) <> 4
      or exists (select 1 from public.interview_questions q where q.interview_id = old.id
        and (q.answer_transcript is null or not exists (select 1 from public.interview_follow_up_decisions d
          where d.question_id = q.id and d.interview_id = old.id and d.answer_transcript = q.answer_transcript)))
    ) then raise exception 'Interview not complete' using errcode = '23514'; end if;
    new.ended_at := greatest(clock_timestamp(), old.started_at);
    new.duration_seconds := floor(extract(epoch from new.ended_at - old.started_at))::integer;
  elsif new.ended_at is not null or new.duration_seconds is not null then
    raise exception 'End metadata requires a terminal status' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_interview_record() from public, anon, authenticated;
create trigger interviews_guard_record before insert or update on public.interviews
  for each row execute function public.guard_interview_record();

create function public.guard_interview_answer()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare session_status text;
begin
  -- Direct table writes use the same session lock as the RPCs.
  if tg_op = 'UPDATE' and new.interview_id is distinct from old.interview_id then
    select status into session_status from public.interviews where id = old.interview_id for update;
    if session_status <> 'in_progress' then
      raise exception 'Interview closed' using errcode = '23514';
    end if;
  end if;
  select status into session_status from public.interviews
    where id = new.interview_id for update;
  if session_status <> 'in_progress' then
    raise exception 'Interview closed' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and old.answer_transcript is not null and (
    new.answer_transcript is distinct from old.answer_transcript or new.answered_at is distinct from old.answered_at
    or (new.id, new.interview_id, new.type, new.parent_question_id, new.order_index, new.question_text)
      is distinct from (old.id, old.interview_id, old.type, old.parent_question_id, old.order_index, old.question_text)
  ) then raise exception 'Answer record is immutable' using errcode = '23514'; end if;
  if new.answer_transcript is not null and (tg_op = 'INSERT' or old.answer_transcript is null) then
    if char_length(new.answer_transcript) > 20000 then
      raise exception 'Invalid answer' using errcode = '23514';
    end if;
    new.answered_at := clock_timestamp();
  end if;
  return new;
end;
$$;
revoke all on function public.guard_interview_answer() from public, anon, authenticated;
create trigger interview_questions_guard_answer before insert or update on public.interview_questions
  for each row execute function public.guard_interview_answer();
