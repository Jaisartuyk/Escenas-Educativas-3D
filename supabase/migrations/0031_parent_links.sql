create table if not exists public.parent_links (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  parent_id uuid not null references public.profiles(id) on delete cascade,
  child_id uuid not null references public.profiles(id) on delete cascade,
  relationship text not null default 'OTRO',
  is_primary boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint parent_links_relationship_check check (relationship in ('MADRE', 'PADRE', 'OTRO')),
  constraint parent_links_unique_pair unique (parent_id, child_id)
);

create index if not exists idx_parent_links_parent_id
  on public.parent_links(parent_id);

create index if not exists idx_parent_links_child_id
  on public.parent_links(child_id);

create index if not exists idx_parent_links_institution_id
  on public.parent_links(institution_id);

create or replace function public.set_parent_links_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_parent_links_updated_at on public.parent_links;

create trigger trg_parent_links_updated_at
before update on public.parent_links
for each row
execute function public.set_parent_links_updated_at();
