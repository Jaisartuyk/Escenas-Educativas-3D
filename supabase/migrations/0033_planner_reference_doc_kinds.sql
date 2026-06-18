-- Clasificacion de documentos del planificador externo
-- PUD: fuente para clase diaria y unidad didactica
-- PCA: fuente para trimestre completo
-- general: apoyo complementario

alter table public.planner_reference_docs
  add column if not exists doc_kind text;

update public.planner_reference_docs
set doc_kind = case
  when concat_ws(' ', titulo, file_name) ~* '(^|[^A-Z])PUD([^A-Z]|$)|PLAN\s+DE\s+UNIDAD|UNIDAD\s+DIDACT'
    then 'pud'
  when concat_ws(' ', titulo, file_name) ~* '(^|[^A-Z])PCA([^A-Z]|$)|PLAN(IFICA(CION)?)?\s+CURRICULAR\s+ANUAL|PLANIFICACION\s+ANUAL'
    then 'pca'
  else 'general'
end
where doc_kind is null;

alter table public.planner_reference_docs
  alter column doc_kind set default 'general';

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'planner_reference_docs'
      and column_name = 'doc_kind'
  ) then
    alter table public.planner_reference_docs
      alter column doc_kind set not null;
  end if;
exception
  when others then
    null;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'planner_reference_docs_doc_kind_check'
  ) then
    alter table public.planner_reference_docs
      add constraint planner_reference_docs_doc_kind_check
      check (doc_kind in ('pud', 'pca', 'general'));
  end if;
end $$;

create index if not exists idx_planner_ref_docs_subject_kind
  on public.planner_reference_docs (planner_subject_id, doc_kind);
