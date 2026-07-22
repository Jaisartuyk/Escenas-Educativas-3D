create table if not exists public.student_scholarships (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  amount_to_pay numeric(10,2) not null check (amount_to_pay >= 0),
  applies_to text not null default 'pension' check (applies_to = 'pension'),
  active boolean not null default true,
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_scholarships_institution_student_unique unique (institution_id, student_id)
);

create index if not exists idx_student_scholarships_institution
  on public.student_scholarships(institution_id);

create index if not exists idx_student_scholarships_student
  on public.student_scholarships(student_id);

alter table public.payments
  add column if not exists scholarship_id uuid references public.student_scholarships(id) on delete set null;

create index if not exists idx_payments_scholarship_id
  on public.payments(scholarship_id);

alter table public.student_scholarships enable row level security;

drop policy if exists "Institution members view scholarships" on public.student_scholarships;
create policy "Institution members view scholarships"
  on public.student_scholarships for select
  using (
    institution_id in (
      select p.institution_id from public.profiles p where p.id = auth.uid()
    )
  );

drop policy if exists "Finance staff manage scholarships" on public.student_scholarships;
create policy "Finance staff manage scholarships"
  on public.student_scholarships for all
  using (
    institution_id in (
      select p.institution_id
      from public.profiles p
      where p.id = auth.uid()
        and p.role::text in ('admin', 'assistant', 'secretary', 'rector')
    )
  )
  with check (
    institution_id in (
      select p.institution_id
      from public.profiles p
      where p.id = auth.uid()
        and p.role::text in ('admin', 'assistant', 'secretary', 'rector')
    )
  );

