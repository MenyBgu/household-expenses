-- הזמנות מאובטחות להצטרפות למשק בית.
create table public.household_invitations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  invited_email text not null check (char_length(invited_email) between 3 and 320),
  invited_by uuid not null references auth.users (id) on delete cascade,
  token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_by uuid references auth.users (id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index household_invitations_one_pending_email
  on public.household_invitations (household_id, invited_email)
  where status = 'pending';

create index household_invitations_household_idx
  on public.household_invitations (household_id, created_at desc);

alter table public.household_invitations enable row level security;

create policy household_invitations_select_admin
  on public.household_invitations for select to authenticated
  using (public.is_household_admin(household_id));

create policy household_invitations_insert_admin
  on public.household_invitations for insert to authenticated
  with check (public.is_household_admin(household_id) and invited_by = auth.uid());

create policy household_invitations_update_admin
  on public.household_invitations for update to authenticated
  using (public.is_household_admin(household_id))
  with check (public.is_household_admin(household_id));

grant select, insert, update on public.household_invitations to authenticated;

create or replace function public.accept_household_invitation(p_token_hash text)
returns public.households
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_email text;
  v_invitation public.household_invitations;
  v_household public.households;
begin
  if v_user is null then
    raise exception 'יש להתחבר כדי לקבל הזמנה';
  end if;

  select lower(email) into v_email from auth.users where id = v_user;
  select * into v_invitation
  from public.household_invitations
  where token_hash = p_token_hash
    and status = 'pending'
    and expires_at > now()
  for update;

  if not found then
    raise exception 'ההזמנה אינה קיימת או שפג תוקפה';
  end if;
  if lower(v_invitation.invited_email) <> coalesce(v_email, '') then
    raise exception 'ההזמנה נשלחה לכתובת אימייל אחרת';
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (v_invitation.household_id, v_user, 'member')
  on conflict (household_id, user_id) do nothing;

  update public.household_invitations
  set status = 'accepted',
      accepted_by = v_user,
      accepted_at = now()
  where id = v_invitation.id;

  select * into v_household
  from public.households
  where id = v_invitation.household_id;
  return v_household;
end;
$$;

grant execute on function public.accept_household_invitation(text) to authenticated;
