create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text unique,
  bio text default '',
  home_base text default '',
  zip_code text not null check (zip_code ~ '^\d{5}$'),
  travel_radius_miles integer not null default 10 check (travel_radius_miles between 0 and 50),
  active_role text not null default 'poster' check (active_role in ('poster', 'tasker')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.tasker_service_areas (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  zip_code text not null check (zip_code ~ '^\d{5}$'),
  created_at timestamptz not null default timezone('utc', now()),
  unique (profile_id, zip_code)
);

create table if not exists public.zip_codes (
  zip_code text primary key check (zip_code ~ '^\d{5}$'),
  city text,
  state_code text,
  latitude double precision not null,
  longitude double precision not null
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  posted_by uuid not null references public.profiles (id) on delete cascade,
  assigned_to uuid references public.profiles (id) on delete set null,
  title text not null,
  description text not null,
  location text not null,
  zip_code text not null check (zip_code ~ '^\d{5}$'),
  budget integer not null check (budget > 0),
  agreed_price integer,
  platform_fee_rate_basis_points integer not null default 1000 check (platform_fee_rate_basis_points between 0 and 10000),
  platform_fee_amount integer not null default 0 check (platform_fee_amount >= 0),
  tasker_payout_amount integer not null default 0 check (tasker_payout_amount >= 0),
  timeline text not null,
  status text not null default 'open' check (status in ('open', 'assigned', 'in_progress', 'completion_requested', 'completed', 'released')),
  payment_status text not null default 'booking_needed' check (payment_status in ('booking_needed', 'booked', 'completion_confirmed', 'closed')),
  completion_requested_at timestamptz,
  completed_at timestamptz,
  posted_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.task_tags (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  label text not null,
  unique (task_id, label)
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  thread_type text not null default 'private' check (thread_type in ('public', 'private')),
  tasker_id uuid references public.profiles (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (task_id, tasker_id)
);

create table if not exists public.conversation_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default timezone('utc', now()),
  unique (conversation_id, profile_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid references public.profiles (id) on delete set null,
  kind text not null default 'message' check (kind in ('message', 'offer', 'question', 'system')),
  body text not null,
  offer_amount integer,
  sent_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  reviewer_id uuid not null references public.profiles (id) on delete cascade,
  reviewee_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('poster', 'tasker')),
  rating integer not null check (rating between 1 and 5),
  body text not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (task_id, reviewer_id, reviewee_id, role)
);

alter table public.profiles add column if not exists travel_radius_miles integer not null default 10;
alter table public.tasks add column if not exists payment_status text not null default 'booking_needed';
alter table public.tasks add column if not exists platform_fee_rate_basis_points integer not null default 1000;
alter table public.tasks add column if not exists platform_fee_amount integer not null default 0;
alter table public.tasks add column if not exists tasker_payout_amount integer not null default 0;
alter table public.tasks add column if not exists completion_requested_at timestamptz;
alter table public.tasks add column if not exists completed_at timestamptz;
alter table public.tasks alter column payment_status set default 'booking_needed';
alter table public.tasks alter column platform_fee_rate_basis_points set default 1000;
alter table public.tasks alter column platform_fee_amount set default 0;
alter table public.tasks alter column tasker_payout_amount set default 0;
alter table public.tasks drop column if exists category_id;
drop table if exists public.categories cascade;
alter table public.conversations add column if not exists tasker_id uuid references public.profiles (id) on delete cascade;
alter table public.conversations add column if not exists thread_type text not null default 'private' check (thread_type in ('public', 'private'));
update public.conversations set thread_type = coalesce(thread_type, 'private');

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'public.tasks'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%status in (%'
  loop
    execute format('alter table public.tasks drop constraint %I', constraint_name);
  end loop;
end $$;

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'public.tasks'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%payment_status%'
  loop
    execute format('alter table public.tasks drop constraint %I', constraint_name);
  end loop;
end $$;

update public.tasks
set payment_status = case
  when payment_status = 'unpaid' then 'booking_needed'
  when payment_status = 'held' then 'booked'
  when payment_status = 'ready_for_payout' then 'completion_confirmed'
  when payment_status = 'paid_out' then 'closed'
  when status = 'released' then 'closed'
  when status = 'completed' then 'completion_confirmed'
  when status = 'assigned' then 'booked'
  else coalesce(payment_status, 'booking_needed')
end;

update public.tasks
set platform_fee_rate_basis_points = 1000
where platform_fee_rate_basis_points is null
   or platform_fee_rate_basis_points < 0
   or platform_fee_rate_basis_points > 10000;

update public.tasks
set platform_fee_amount = round(coalesce(agreed_price, budget) * 0.10),
    tasker_payout_amount = greatest(coalesce(agreed_price, budget) - round(coalesce(agreed_price, budget) * 0.10), 0)
where (platform_fee_amount = 0 and tasker_payout_amount = 0)
   or platform_fee_amount is null
   or tasker_payout_amount is null;

update public.tasks
set status = 'in_progress'
where status = 'assigned' and assigned_to is not null;

alter table public.tasks
drop constraint if exists tasks_status_check;

alter table public.tasks
add constraint tasks_status_check
check (status in ('open', 'assigned', 'in_progress', 'completion_requested', 'completed', 'released'));

alter table public.tasks
drop constraint if exists tasks_payment_status_check;

alter table public.tasks
add constraint tasks_payment_status_check
check (payment_status in ('booking_needed', 'booked', 'completion_confirmed', 'closed'));

alter table public.tasks
drop constraint if exists tasks_platform_fee_rate_basis_points_check;

alter table public.tasks
add constraint tasks_platform_fee_rate_basis_points_check
check (platform_fee_rate_basis_points between 0 and 10000);

alter table public.tasks
drop constraint if exists tasks_platform_fee_amount_check;

alter table public.tasks
add constraint tasks_platform_fee_amount_check
check (platform_fee_amount >= 0);

alter table public.tasks
drop constraint if exists tasks_tasker_payout_amount_check;

alter table public.tasks
add constraint tasks_tasker_payout_amount_check
check (tasker_payout_amount >= 0);

do $$
declare
  existing_constraint_name text;
begin
  select conname
  into existing_constraint_name
  from pg_constraint
  where conrelid = 'public.conversations'::regclass
    and contype = 'u'
    and conname <> 'conversations_task_id_tasker_id_key'
    and pg_get_constraintdef(oid) like 'UNIQUE (task_id)%';

  if existing_constraint_name is not null then
    execute format('alter table public.conversations drop constraint %I', existing_constraint_name);
  end if;
end $$;

update public.conversations c
set tasker_id = (
  select cp.profile_id
  from public.conversation_participants cp
  join public.tasks t on t.id = c.task_id
  where cp.conversation_id = c.id
    and cp.profile_id <> t.posted_by
  limit 1
)
where c.tasker_id is null;

drop index if exists idx_conversations_task_tasker_unique;
create unique index if not exists idx_conversations_public_unique
on public.conversations (task_id)
where thread_type = 'public';

create unique index if not exists idx_conversations_task_tasker_unique
on public.conversations (task_id, tasker_id)
where thread_type = 'private' and tasker_id is not null;

create index if not exists idx_profiles_zip_code on public.profiles (zip_code);
create index if not exists idx_zip_codes_zip_code on public.zip_codes (zip_code);
create index if not exists idx_tasker_service_areas_zip_code on public.tasker_service_areas (zip_code);
create index if not exists idx_tasks_zip_code on public.tasks (zip_code);
create index if not exists idx_tasks_posted_by on public.tasks (posted_by);
create index if not exists idx_conversations_task_id on public.conversations (task_id);
create index if not exists idx_conversations_task_tasker on public.conversations (task_id, tasker_id);
create index if not exists idx_messages_conversation_id on public.messages (conversation_id, sent_at);

alter table public.profiles enable row level security;
alter table public.tasker_service_areas enable row level security;
alter table public.zip_codes enable row level security;
alter table public.tasks enable row level security;
alter table public.task_tags enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.reviews enable row level security;

drop policy if exists "profiles are readable by signed in users" on public.profiles;
create policy "profiles are readable by signed in users"
on public.profiles for select
to authenticated
using (true);

drop policy if exists "users manage own profile" on public.profiles;
create policy "users manage own profile"
on public.profiles for all
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "service areas readable by signed in users" on public.tasker_service_areas;
create policy "service areas readable by signed in users"
on public.tasker_service_areas for select
to authenticated
using (true);

drop policy if exists "zip codes readable by signed in users" on public.zip_codes;
create policy "zip codes readable by signed in users"
on public.zip_codes for select
to authenticated
using (true);

drop policy if exists "users manage own service areas" on public.tasker_service_areas;
create policy "users manage own service areas"
on public.tasker_service_areas for all
to authenticated
using (auth.uid() = profile_id)
with check (auth.uid() = profile_id);

create or replace function public.zip_distance_miles(origin_zip text, target_zip text)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  with origin as (
    select latitude, longitude
    from public.zip_codes
    where zip_code = origin_zip
  ),
  target as (
    select latitude, longitude
    from public.zip_codes
    where zip_code = target_zip
  )
  select
    case
      when exists(select 1 from origin) and exists(select 1 from target) then
        3958.7613 * acos(
          least(
            1,
            cos(radians((select latitude from origin))) *
            cos(radians((select latitude from target))) *
            cos(radians((select longitude from target)) - radians((select longitude from origin))) +
            sin(radians((select latitude from origin))) *
            sin(radians((select latitude from target)))
          )
        )
      else null
    end;
$$;

create or replace function public.nearby_zip_codes(origin_zip text, radius_miles integer)
returns table (zip_code text, distance_miles numeric)
language sql
stable
security definer
set search_path = public
as $$
  select
    z.zip_code,
    public.zip_distance_miles(origin_zip, z.zip_code) as distance_miles
  from public.zip_codes z
  where public.zip_distance_miles(origin_zip, z.zip_code) is not null
    and public.zip_distance_miles(origin_zip, z.zip_code) <= greatest(radius_miles, 0)
  order by distance_miles asc, z.zip_code asc;
$$;

create or replace function public.tasker_can_reach_zip(profile_uuid uuid, target_zip text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with profile_data as (
    select zip_code, travel_radius_miles
    from public.profiles
    where id = profile_uuid
  )
  select exists (
    select 1
    from profile_data pd
    where
      pd.zip_code = target_zip
      or exists (
        select 1
        from public.tasker_service_areas tsa
        where tsa.profile_id = profile_uuid
          and tsa.zip_code = target_zip
      )
      or (
        public.zip_distance_miles(pd.zip_code, target_zip) is not null
        and public.zip_distance_miles(pd.zip_code, target_zip) <= pd.travel_radius_miles
      )
  );
$$;

drop policy if exists "tasks are visible to posters and matching taskers" on public.tasks;
create policy "tasks are visible to posters and matching taskers"
on public.tasks for select
to authenticated
using (
  posted_by = auth.uid()
  or assigned_to = auth.uid()
  or public.tasker_can_reach_zip(auth.uid(), tasks.zip_code)
);

drop policy if exists "posters create their own tasks" on public.tasks;
create policy "posters create their own tasks"
on public.tasks for insert
to authenticated
with check (posted_by = auth.uid());

drop policy if exists "posters update their own tasks" on public.tasks;
create policy "posters update their own tasks"
on public.tasks for update
to authenticated
using (posted_by = auth.uid() or assigned_to = auth.uid())
with check (posted_by = auth.uid() or assigned_to = auth.uid());

drop policy if exists "posters delete their own open tasks" on public.tasks;
create policy "posters delete their own open tasks"
on public.tasks for delete
to authenticated
using (posted_by = auth.uid() and status = 'open');

drop policy if exists "task tags follow task visibility" on public.task_tags;
create policy "task tags follow task visibility"
on public.task_tags for select
to authenticated
using (
  exists (
    select 1
    from public.tasks
    where tasks.id = task_tags.task_id
      and (
        tasks.posted_by = auth.uid()
        or tasks.assigned_to = auth.uid()
        or public.tasker_can_reach_zip(auth.uid(), tasks.zip_code)
      )
  )
);

drop policy if exists "task owners manage tags" on public.task_tags;
create policy "task owners manage tags"
on public.task_tags for all
to authenticated
using (
  exists (
    select 1
    from public.tasks
    where tasks.id = task_tags.task_id
      and tasks.posted_by = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.tasks
    where tasks.id = task_tags.task_id
      and tasks.posted_by = auth.uid()
  )
);

drop policy if exists "participants read conversations" on public.conversations;
create policy "participants read conversations"
on public.conversations for select
to authenticated
using (
  exists (
    select 1
    from public.tasks
    where tasks.id = conversations.task_id
      and (
        tasks.posted_by = auth.uid()
        or conversations.tasker_id = auth.uid()
        or (
          conversations.thread_type = 'public'
          and public.tasker_can_reach_zip(auth.uid(), tasks.zip_code)
        )
      )
  )
);

drop policy if exists "participants manage conversation rows" on public.conversations;
create policy "participants manage conversation rows"
on public.conversations for all
to authenticated
using (
  exists (
    select 1
    from public.tasks
    where tasks.id = conversations.task_id
      and (
        tasks.posted_by = auth.uid()
        or conversations.tasker_id = auth.uid()
        or (
          conversations.thread_type = 'public'
          and public.tasker_can_reach_zip(auth.uid(), tasks.zip_code)
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.tasks
    where tasks.id = conversations.task_id
      and (
        tasks.posted_by = auth.uid()
        or conversations.tasker_id = auth.uid()
      )
  )
);

drop policy if exists "visible task users can create conversations" on public.conversations;
create policy "visible task users can create conversations"
on public.conversations for insert
to authenticated
with check (
  exists (
    select 1
    from public.tasks
    where tasks.id = conversations.task_id
      and (
        (
          tasks.posted_by = auth.uid()
          and conversations.thread_type = 'public'
          and conversations.tasker_id is null
        )
        or (
          conversations.thread_type = 'public'
          and conversations.tasker_id is null
          and public.tasker_can_reach_zip(auth.uid(), tasks.zip_code)
        )
        or (
          conversations.thread_type = 'private'
          and
          conversations.tasker_id = auth.uid()
          and tasks.posted_by <> auth.uid()
          and public.tasker_can_reach_zip(auth.uid(), tasks.zip_code)
        )
      )
  )
);

drop policy if exists "participants read conversation participants" on public.conversation_participants;
create policy "participants read conversation participants"
on public.conversation_participants for select
to authenticated
using (
  exists (
    select 1
    from public.conversations
    join public.tasks on tasks.id = conversations.task_id
    where conversations.id = conversation_participants.conversation_id
      and (
        tasks.posted_by = auth.uid()
        or conversations.tasker_id = auth.uid()
        or (
          conversations.thread_type = 'public'
          and public.tasker_can_reach_zip(auth.uid(), tasks.zip_code)
        )
      )
  )
);

drop policy if exists "users add themselves to conversations" on public.conversation_participants;
create policy "users add themselves to conversations"
on public.conversation_participants for insert
to authenticated
with check (profile_id = auth.uid());

drop policy if exists "conversation creators can add valid participants" on public.conversation_participants;
create policy "conversation creators can add valid participants"
on public.conversation_participants for insert
to authenticated
with check (
  exists (
    select 1
    from public.conversations
    join public.tasks on tasks.id = conversations.task_id
    where conversations.id = conversation_participants.conversation_id
      and (
        (
          conversations.thread_type = 'public'
          and (
            conversation_participants.profile_id = auth.uid()
            or tasks.posted_by = auth.uid()
            or public.tasker_can_reach_zip(auth.uid(), tasks.zip_code)
          )
        )
        or (
          conversations.thread_type = 'private'
          and (
            conversation_participants.profile_id = auth.uid()
            or (tasks.posted_by = auth.uid() and conversation_participants.profile_id = conversations.tasker_id)
            or (conversations.tasker_id = auth.uid() and conversation_participants.profile_id = tasks.posted_by)
          )
        )
      )
  )
);

drop policy if exists "participants read messages" on public.messages;
create policy "participants read messages"
on public.messages for select
to authenticated
using (
  exists (
    select 1
    from public.conversations
    join public.tasks on tasks.id = conversations.task_id
    where conversations.id = messages.conversation_id
      and (
        tasks.posted_by = auth.uid()
        or conversations.tasker_id = auth.uid()
        or (
          conversations.thread_type = 'public'
          and public.tasker_can_reach_zip(auth.uid(), tasks.zip_code)
        )
      )
  )
);

drop policy if exists "participants send messages" on public.messages;
create policy "participants send messages"
on public.messages for insert
to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1
    from public.conversations
    join public.tasks on tasks.id = conversations.task_id
    where conversations.id = messages.conversation_id
      and (
        tasks.posted_by = auth.uid()
        or conversations.tasker_id = auth.uid()
        or (
          conversations.thread_type = 'public'
          and public.tasker_can_reach_zip(auth.uid(), tasks.zip_code)
        )
      )
  )
);

drop policy if exists "participants read reviews tied to their tasks" on public.reviews;
create policy "participants read reviews tied to their tasks"
on public.reviews for select
to authenticated
using (
  reviewer_id = auth.uid()
  or reviewee_id = auth.uid()
  or exists (
    select 1
    from public.tasks
    where tasks.id = reviews.task_id
      and (tasks.posted_by = auth.uid() or tasks.assigned_to = auth.uid())
  )
);

drop policy if exists "participants write one review per role" on public.reviews;
create policy "participants write one review per role"
on public.reviews for insert
to authenticated
with check (
  reviewer_id = auth.uid()
  and exists (
    select 1
    from public.tasks
    where tasks.id = reviews.task_id
      and (
        (reviews.role = 'tasker' and tasks.posted_by = auth.uid() and tasks.assigned_to = reviews.reviewee_id)
        or
        (reviews.role = 'poster' and tasks.assigned_to = auth.uid() and tasks.posted_by = reviews.reviewee_id)
      )
      and tasks.status in ('completed', 'released')
  )
);
