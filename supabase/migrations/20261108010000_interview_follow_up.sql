-- The database policy matches MAX_FOLLOW_UPS=2 in src/config/interview.ts.
alter table public.interview_questions add constraint follow_up_order_cap
  check (type <> 'follow_up' or order_index < 2);
create unique index interview_follow_up_order_unique
  on public.interview_questions(interview_id, parent_question_id, order_index) where type = 'follow_up';

-- A null decision must also survive retries. This is not the common answer store.
create table public.interview_follow_up_decisions (
  question_id uuid primary key,
  interview_id uuid not null,
  answer_transcript text not null check (char_length(answer_transcript) <= 20000),
  follow_up text check (follow_up is null or follow_up ~ '[^[:space:]]'),
  foreign key (question_id, interview_id)
    references public.interview_questions(id, interview_id) on delete cascade
);
alter table public.interview_follow_up_decisions enable row level security;
revoke all on public.interview_follow_up_decisions from public, anon, authenticated;
grant select, insert on public.interview_follow_up_decisions to authenticated;
grant all on public.interview_follow_up_decisions to service_role;
create policy interview_follow_up_decisions_owner on public.interview_follow_up_decisions
  for all to authenticated
  using (exists (select 1 from public.interviews i
    where i.id = interview_id and i.user_id = (select auth.uid())))
  with check (exists (select 1 from public.interviews i
    where i.id = interview_id and i.user_id = (select auth.uid())));

create function public.save_interview_follow_up(
  target_interview_id uuid, source_question_id uuid, expected_user_id uuid,
  answer text, generated_follow_up text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  session_row public.interviews;
  source_row public.interview_questions;
  root_row public.interview_questions;
  decision public.interview_follow_up_decisions;
  child_count integer;
  result text;
begin
  if auth.uid() is null or expected_user_id is distinct from auth.uid() then
    raise exception 'Owner mismatch' using errcode = '42501';
  end if;
  if answer is null or char_length(answer) > 20000
    or (generated_follow_up is not null and generated_follow_up !~ '[^[:space:]]') then
    raise exception 'Invalid answer or question' using errcode = '22023';
  end if;
  -- All API writers lock the same session, including retries and different source questions.
  select * into session_row from public.interviews
    where id = target_interview_id and user_id = expected_user_id for update;
  if not found then raise exception 'Interview not found' using errcode = 'P0002'; end if;
  if session_row.status <> 'in_progress' then
    raise exception 'Interview closed' using errcode = 'P0010';
  end if;
  select * into source_row from public.interview_questions
    where id = source_question_id and interview_id = target_interview_id for update;
  if not found then raise exception 'Question not found' using errcode = 'P0002'; end if;
  select * into decision from public.interview_follow_up_decisions
    where question_id = source_question_id and interview_id = target_interview_id;
  if found then
    if decision.answer_transcript is distinct from answer then
      raise exception 'Answer conflict' using errcode = 'P0011';
    end if;
    return jsonb_build_object('followUp', decision.follow_up);
  end if;
  select * into root_row from public.interview_questions
    where id = coalesce(source_row.parent_question_id, source_row.id)
      and interview_id = target_interview_id and type = 'main' for update;
  if not found then raise exception 'Invalid parent' using errcode = 'P0011'; end if;
  select count(*) into child_count from public.interview_questions
    where interview_id = target_interview_id and parent_question_id = root_row.id and type = 'follow_up';
  if (source_row.type = 'main' and child_count <> 0)
    or (source_row.type = 'follow_up' and source_row.order_index <> child_count - 1) then
    raise exception 'Stale source question' using errcode = 'P0011';
  end if;
  result := case when child_count >= 2 or answer !~ '[^[:space:]]' then null else btrim(generated_follow_up) end;
  if result is not null then
    insert into public.interview_questions
      (interview_id, type, parent_question_id, order_index, question_text)
      values (target_interview_id, 'follow_up', root_row.id, child_count, result);
  end if;
  insert into public.interview_follow_up_decisions(question_id, interview_id, answer_transcript, follow_up)
    values (source_question_id, target_interview_id, answer, result);
  return jsonb_build_object('followUp', result);
end;
$$;
revoke all on function public.save_interview_follow_up(uuid, uuid, uuid, text, text) from public, anon;
grant execute on function public.save_interview_follow_up(uuid, uuid, uuid, text, text) to authenticated;
