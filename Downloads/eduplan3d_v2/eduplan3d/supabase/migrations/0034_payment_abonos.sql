create table if not exists public.payment_abonos (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  institution_id uuid not null,
  student_id uuid not null,
  amount numeric(10,2) not null check (amount > 0),
  paid_at date not null default current_date,
  note text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_payment_abonos_payment_id
  on public.payment_abonos(payment_id);

create index if not exists idx_payment_abonos_student_id
  on public.payment_abonos(student_id);

create index if not exists idx_payment_abonos_institution_id
  on public.payment_abonos(institution_id);
