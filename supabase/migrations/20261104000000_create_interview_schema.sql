-- Domain schema. Auth users/roles are managed by Supabase.
create table public.cover_letters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_name text not null,
  job_title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.essay_items (
  id uuid primary key default gen_random_uuid(),
  cover_letter_id uuid not null references public.cover_letters(id) on delete cascade,
  position integer not null default 0 check (position >= 0),
  question text not null,
  answer text not null default '',
  created_at timestamptz not null default now()
);

create table public.experiences (
  id uuid primary key default gen_random_uuid(),
  cover_letter_id uuid not null references public.cover_letters(id) on delete cascade,
  position integer not null default 0 check (position >= 0),
  content text not null,
  created_at timestamptz not null default now()
);

create table public.interviews (
  id uuid primary key default gen_random_uuid(),
  cover_letter_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'completed', 'aborted')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer check (duration_seconds >= 0),
  recording_path text,
  created_at timestamptz not null default now(),
  check (ended_at >= started_at),
  -- A matching owner is required even when a privileged writer bypasses RLS.
  foreign key (cover_letter_id, user_id)
    references public.cover_letters(id, user_id) on delete cascade
);

create table public.interview_questions (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.interviews(id) on delete cascade,
  type text not null check (type in ('main', 'follow_up')),
  parent_question_id uuid,
  order_index integer not null check (order_index >= 0),
  question_text text not null,
  answer_transcript text,
  answer_audio_path text,
  asked_at timestamptz,
  answered_at timestamptz,
  unique (id, interview_id),
  check (
    (type = 'main' and parent_question_id is null)
    or (type = 'follow_up' and parent_question_id is not null)
  ),
  check (parent_question_id <> id),
  -- A plain parent UUID FK would allow references to another user's question.
  foreign key (parent_question_id, interview_id)
    references public.interview_questions(id, interview_id) on delete cascade
);

create index cover_letters_user_created_idx on public.cover_letters(user_id, created_at desc);
create index essay_items_cover_position_idx on public.essay_items(cover_letter_id, position);
create index experiences_cover_position_idx on public.experiences(cover_letter_id, position);
create index interviews_user_started_idx on public.interviews(user_id, started_at desc);
create index interviews_cover_idx on public.interviews(cover_letter_id);
create index interview_questions_interview_order_idx on public.interview_questions(interview_id, order_index);
create index interview_questions_parent_idx on public.interview_questions(parent_question_id, interview_id);

create function public.set_cover_letter_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = statement_timestamp();
  return new;
end;
$$;

revoke all on function public.set_cover_letter_updated_at() from public, anon, authenticated;

create trigger cover_letters_set_updated_at
before update on public.cover_letters
for each row execute function public.set_cover_letter_updated_at();

alter table public.cover_letters enable row level security;
alter table public.essay_items enable row level security;
alter table public.experiences enable row level security;
alter table public.interviews enable row level security;
alter table public.interview_questions enable row level security;

-- Do not inherit Supabase's historical ALL grants (notably TRUNCATE bypasses RLS).
revoke all on table public.cover_letters, public.essay_items, public.experiences,
  public.interviews, public.interview_questions from public, anon, authenticated;
grant select, insert, update, delete on table public.cover_letters, public.essay_items,
  public.experiences, public.interviews, public.interview_questions to authenticated, service_role;

create policy cover_letters_owner on public.cover_letters
for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy essay_items_owner on public.essay_items
for all to authenticated
using (exists (
  select 1 from public.cover_letters cl
  where cl.id = essay_items.cover_letter_id and cl.user_id = (select auth.uid())
))
with check (exists (
  select 1 from public.cover_letters cl
  where cl.id = essay_items.cover_letter_id and cl.user_id = (select auth.uid())
));

create policy experiences_owner on public.experiences
for all to authenticated
using (exists (
  select 1 from public.cover_letters cl
  where cl.id = experiences.cover_letter_id and cl.user_id = (select auth.uid())
))
with check (exists (
  select 1 from public.cover_letters cl
  where cl.id = experiences.cover_letter_id and cl.user_id = (select auth.uid())
));

create policy interviews_owner on public.interviews
for all to authenticated
using (user_id = (select auth.uid()) and exists (
  select 1 from public.cover_letters cl
  where cl.id = interviews.cover_letter_id and cl.user_id = (select auth.uid())
))
with check (user_id = (select auth.uid()) and exists (
  select 1 from public.cover_letters cl
  where cl.id = interviews.cover_letter_id and cl.user_id = (select auth.uid())
));

create policy interview_questions_owner on public.interview_questions
for all to authenticated
using (exists (
  select 1 from public.interviews i
  where i.id = interview_questions.interview_id and i.user_id = (select auth.uid())
))
with check (exists (
  select 1 from public.interviews i
  where i.id = interview_questions.interview_id and i.user_id = (select auth.uid())
));
