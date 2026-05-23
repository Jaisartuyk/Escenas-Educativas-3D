create or replace function public.prevent_duplicate_recurring_payments()
returns trigger
language plpgsql
as $$
declare
  conflicting_payment_id uuid;
  normalized_description text;
  description_year text;
  description_month text;
  recurring_period_key text;
  existing_period_key text;
begin
  if new.type not in ('matricula', 'pension') then
    return new;
  end if;

  if new.institution_id is null or new.student_id is null then
    return new;
  end if;

  if new.due_date is not null then
    if new.type = 'matricula' then
      recurring_period_key := 'matricula:' || extract(year from new.due_date::date)::text;
    else
      recurring_period_key := 'pension:' || to_char(new.due_date::date, 'YYYY-MM');
    end if;
  else
    normalized_description := lower(coalesce(new.description, ''));
    normalized_description := translate(normalized_description, '??????????', 'aeiouAEIOU');
    normalized_description := replace(normalized_description, '?', '-');
    normalized_description := replace(normalized_description, '?', '-');

    description_year := substring(normalized_description from '(20[0-9]{2})');

    if description_year is null then
      raise exception 'missing recurring payment period'
        using errcode = '23514',
              hint = 'Los cobros de matr?cula y pensi?n deben incluir una fecha de vencimiento o un a?o identificable.';
    end if;

    if new.type = 'matricula' then
      recurring_period_key := 'matricula:' || description_year;
    else
      if normalized_description like '%enero%' then description_month := '01';
      elsif normalized_description like '%febrero%' then description_month := '02';
      elsif normalized_description like '%marzo%' then description_month := '03';
      elsif normalized_description like '%abril%' then description_month := '04';
      elsif normalized_description like '%mayo%' then description_month := '05';
      elsif normalized_description like '%junio%' then description_month := '06';
      elsif normalized_description like '%julio%' then description_month := '07';
      elsif normalized_description like '%agosto%' then description_month := '08';
      elsif normalized_description like '%septiembre%' or normalized_description like '%setiembre%' then description_month := '09';
      elsif normalized_description like '%octubre%' then description_month := '10';
      elsif normalized_description like '%noviembre%' then description_month := '11';
      elsif normalized_description like '%diciembre%' then description_month := '12';
      else
        raise exception 'missing recurring payment period'
          using errcode = '23514',
                hint = 'Las pensiones deben incluir una fecha de vencimiento o un mes identificable en la descripci?n.';
      end if;

      recurring_period_key := 'pension:' || description_year || '-' || description_month;
    end if;
  end if;

  select p.id
    into conflicting_payment_id
  from public.payments p
  cross join lateral (
    select case
      when p.type = 'matricula' and p.due_date is not null then 'matricula:' || extract(year from p.due_date::date)::text
      when p.type = 'pension' and p.due_date is not null then 'pension:' || to_char(p.due_date::date, 'YYYY-MM')
      when p.type = 'matricula' then 'matricula:' || substring(lower(coalesce(p.description, '')) from '(20[0-9]{2})')
      when p.type = 'pension' then
        case
          when lower(coalesce(p.description, '')) like '%enero%' then 'pension:' || substring(lower(coalesce(p.description, '')) from '(20[0-9]{2})') || '-01'
          when lower(coalesce(p.description, '')) like '%febrero%' then 'pension:' || substring(lower(coalesce(p.description, '')) from '(20[0-9]{2})') || '-02'
          when lower(coalesce(p.description, '')) like '%marzo%' then 'pension:' || substring(lower(coalesce(p.description, '')) from '(20[0-9]{2})') || '-03'
          when lower(coalesce(p.description, '')) like '%abril%' then 'pension:' || substring(lower(coalesce(p.description, '')) from '(20[0-9]{2})') || '-04'
          when lower(coalesce(p.description, '')) like '%mayo%' then 'pension:' || substring(lower(coalesce(p.description, '')) from '(20[0-9]{2})') || '-05'
          when lower(coalesce(p.description, '')) like '%junio%' then 'pension:' || substring(lower(coalesce(p.description, '')) from '(20[0-9]{2})') || '-06'
          when lower(coalesce(p.description, '')) like '%julio%' then 'pension:' || substring(lower(coalesce(p.description, '')) from '(20[0-9]{2})') || '-07'
          when lower(coalesce(p.description, '')) like '%agosto%' then 'pension:' || substring(lower(coalesce(p.description, '')) from '(20[0-9]{2})') || '-08'
          when lower(coalesce(p.description, '')) like '%septiembre%' or lower(coalesce(p.description, '')) like '%setiembre%' then 'pension:' || substring(lower(coalesce(p.description, '')) from '(20[0-9]{2})') || '-09'
          when lower(coalesce(p.description, '')) like '%octubre%' then 'pension:' || substring(lower(coalesce(p.description, '')) from '(20[0-9]{2})') || '-10'
          when lower(coalesce(p.description, '')) like '%noviembre%' then 'pension:' || substring(lower(coalesce(p.description, '')) from '(20[0-9]{2})') || '-11'
          when lower(coalesce(p.description, '')) like '%diciembre%' then 'pension:' || substring(lower(coalesce(p.description, '')) from '(20[0-9]{2})') || '-12'
          else null
        end
      else null
    end as period_key
  ) derived
  where p.institution_id = new.institution_id
    and p.student_id = new.student_id
    and p.type = new.type
    and (new.id is null or p.id <> new.id)
    and derived.period_key = recurring_period_key
  limit 1;

  if conflicting_payment_id is not null then
    raise exception 'duplicate recurring payment'
      using errcode = '23505',
            detail = conflicting_payment_id::text,
            hint = 'Ya existe un cobro del mismo periodo para este alumno.';
  end if;

  return new;
end;
$$;
