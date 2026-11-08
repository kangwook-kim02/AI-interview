-- Persist a new session and its four main questions in a single transaction.
create function public.create_interview(
  target_cover_letter_id uuid,
  expected_user_id uuid,
  questions jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  created_interview_id uuid;
begin
  if owner_id is null or expected_user_id is distinct from owner_id then
    raise exception 'Authentication required or owner mismatch' using errcode = '42501';
  end if;
  if jsonb_typeof(questions) is distinct from 'array' then
    raise exception 'Expected questions array' using errcode = '22023';
  end if;
  -- This API's policy matches MAIN_QUESTION_COUNT in src/config/interview.ts.
  if jsonb_array_length(questions) <> 4 then
    raise exception 'Exactly four main questions are required' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(questions) item
    where jsonb_typeof(item) is distinct from 'string'
      or (item #>> '{}') !~ '[^[:space:]]'
  ) then
    raise exception 'Nonblank question strings are required' using errcode = '22023';
  end if;

  perform 1 from public.cover_letters cl
    where cl.id = target_cover_letter_id and cl.user_id = owner_id for update;
  if not found then
    raise exception 'Cover letter not found' using errcode = 'P0002';
  end if;
  insert into public.interviews (cover_letter_id, user_id, status)
    values (target_cover_letter_id, owner_id, 'in_progress') returning id into created_interview_id;
  insert into public.interview_questions (interview_id, type, parent_question_id, order_index, question_text)
    select created_interview_id, 'main', null, (ordinality - 1)::integer, btrim(item #>> '{}')
    from jsonb_array_elements(questions) with ordinality as entries(item, ordinality);
  return created_interview_id;
end;
$$;

revoke all on function public.create_interview(uuid, uuid, jsonb) from public, anon;
grant execute on function public.create_interview(uuid, uuid, jsonb) to authenticated;
