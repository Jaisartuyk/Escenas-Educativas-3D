alter table if exists public.historical_debts
  add column if not exists debtor_type text;

alter table if exists public.historical_debts
  add column if not exists external_name text;

alter table if exists public.historical_debts
  add column if not exists external_identifier text;

alter table if exists public.historical_debts
  add column if not exists external_phone text;

update public.historical_debts
set debtor_type = case
  when coalesce(student_id::text, '') <> '' then 'student'
  else 'external'
end
where debtor_type is null;

alter table if exists public.historical_debts
  alter column debtor_type set default 'student';

alter table if exists public.historical_debts
  alter column debtor_type set not null;

do $$
begin
  begin
    alter table public.historical_debts alter column student_id drop not null;
  exception
    when others then null;
  end;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'historical_debts_debtor_type_check'
  ) then
    alter table public.historical_debts
      add constraint historical_debts_debtor_type_check
      check (debtor_type in ('student', 'external'));
  end if;
end $$;

create index if not exists historical_debts_institution_debtor_idx
  on public.historical_debts (institution_id, debtor_type);
