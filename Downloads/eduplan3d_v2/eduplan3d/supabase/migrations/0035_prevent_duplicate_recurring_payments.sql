create or replace function public.prevent_duplicate_recurring_payments()
returns trigger
language plpgsql
as $$
declare
  conflicting_payment_id uuid;
begin
  if new.type not in ('matricula', 'pension') then
    return new;
  end if;

  if new.institution_id is null or new.student_id is null or new.due_date is null then
    return new;
  end if;

  if new.type = 'matricula' then
    select p.id
      into conflicting_payment_id
    from public.payments p
    where p.institution_id = new.institution_id
      and p.student_id = new.student_id
      and p.type = 'matricula'
      and p.due_date is not null
      and extract(year from p.due_date::date) = extract(year from new.due_date::date)
      and (new.id is null or p.id <> new.id)
    limit 1;
  else
    select p.id
      into conflicting_payment_id
    from public.payments p
    where p.institution_id = new.institution_id
      and p.student_id = new.student_id
      and p.type = 'pension'
      and p.due_date is not null
      and date_trunc('month', p.due_date::date) = date_trunc('month', new.due_date::date)
      and (new.id is null or p.id <> new.id)
    limit 1;
  end if;

  if conflicting_payment_id is not null then
    raise exception 'duplicate recurring payment'
      using errcode = '23505',
            detail = conflicting_payment_id::text,
            hint = 'Ya existe un cobro del mismo periodo para este alumno.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_duplicate_recurring_payments on public.payments;

create trigger trg_prevent_duplicate_recurring_payments
before insert or update on public.payments
for each row
execute procedure public.prevent_duplicate_recurring_payments();
