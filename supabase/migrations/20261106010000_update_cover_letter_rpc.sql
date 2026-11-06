-- Lock and replace one owned card atomically; any child failure restores all original rows.
create function public.update_cover_letter(
  target_cover_letter_id uuid,
  expected_user_id uuid,
  company_name text,
  job_title text,
  essays jsonb,
  experiences jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  cover_id uuid := target_cover_letter_id;
begin
  if owner_id is null or expected_user_id is distinct from owner_id then
    raise exception 'Authentication required or owner mismatch' using errcode = '42501';
  end if;
  if nullif(btrim(company_name), '') is null or nullif(btrim(job_title), '') is null then
    raise exception 'Company and job title are required' using errcode = '22023';
  end if;
  if jsonb_typeof(essays) is distinct from 'array'
    or jsonb_typeof(experiences) is distinct from 'array' then
    raise exception 'Expected item arrays' using errcode = '22023';
  end if;
  if jsonb_array_length(essays) < 1 then
    raise exception 'At least one essay is required' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(essays) item
    where jsonb_typeof(item -> 'question') is distinct from 'string'
      or jsonb_typeof(item -> 'answer') is distinct from 'string'
      or nullif(btrim(item ->> 'question'), '') is null
      or nullif(btrim(item ->> 'answer'), '') is null
  ) or exists (
    select 1 from jsonb_array_elements(experiences) item
    where jsonb_typeof(item -> 'content') is distinct from 'string'
      or nullif(btrim(item ->> 'content'), '') is null
  ) then
    raise exception 'Item text is required' using errcode = '22023';
  end if;

  perform 1 from public.cover_letters cl
    where cl.id = cover_id and cl.user_id = owner_id for update;
  if not found then
    raise exception 'Cover letter not found' using errcode = 'P0002';
  end if;
  update public.cover_letters cl
    set company_name = btrim(update_cover_letter.company_name),
        job_title = btrim(update_cover_letter.job_title)
    where cl.id = cover_id and cl.user_id = owner_id;
  delete from public.essay_items where cover_letter_id = cover_id;
  delete from public.experiences where cover_letter_id = cover_id;
  insert into public.essay_items (cover_letter_id, position, question, answer)
    select cover_id, (ordinality - 1)::integer, btrim(item ->> 'question'), btrim(item ->> 'answer')
    from jsonb_array_elements(essays) with ordinality as entries(item, ordinality);
  insert into public.experiences (cover_letter_id, position, content)
    select cover_id, (ordinality - 1)::integer, btrim(item ->> 'content')
    from jsonb_array_elements(experiences) with ordinality as entries(item, ordinality);
  return cover_id;
end;
$$;

revoke all on function public.update_cover_letter(uuid, uuid, text, text, jsonb, jsonb) from public, anon;
grant execute on function public.update_cover_letter(uuid, uuid, text, text, jsonb, jsonb) to authenticated;
