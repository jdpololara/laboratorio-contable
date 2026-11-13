-- Membresías, cargos, empresas personales y de equipo, e historial.
-- No reescribe las migraciones ya aplicadas. owner_id deja de autorizar.

-- ---------------------------------------------------------------------------
-- Aulas de cada persona y cargos del aula
-- ---------------------------------------------------------------------------

create table public.classroom_members (
  user_id uuid not null references public.profiles (id) on delete cascade,
  classroom_id uuid not null references public.classrooms (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, classroom_id)
);

comment on table public.classroom_members is
  'Aulas de una persona. El registro elige la primera. El docente puede sumar otras.';

create index classroom_members_classroom_id_idx
  on public.classroom_members (classroom_id);

create table public.cargos (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms (id) on delete cascade,
  name text not null,
  label_only boolean not null default true,
  created_at timestamptz not null default now(),
  unique (classroom_id, name),
  constraint cargos_name_ok check (char_length(btrim(name)) > 0)
);

comment on table public.cargos is
  'Cargos del aula. El alumno elige uno al entrar a la empresa. No es el rol del tercero.';

comment on column public.cargos.label_only is
  'Si es cierto, el cargo solo nombra y la membresía nace pudiendo hacer el trabajo, sin borrar la empresa.';

create index cargos_classroom_id_idx on public.cargos (classroom_id);

create or replace function private.seed_classroom_cargos()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.cargos (classroom_id, name, label_only) values
    (new.id, 'auxiliar contable', true),
    (new.id, 'contador', true),
    (new.id, 'administrador', true),
    (new.id, 'auditor', false);
  return new;
end;
$$;

create trigger classrooms_seed_cargos
  after insert on public.classrooms
  for each row
  execute function private.seed_classroom_cargos();

create or replace function private.guard_cargo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.name := btrim(new.name);

  if exists (
    select 1
    from public.cargos
    where classroom_id = new.classroom_id
      and lower(name) = lower(new.name)
      and id is distinct from new.id
  ) then
    raise exception 'Ese cargo ya está en el aula';
  end if;

  return new;
end;
$$;

create trigger cargos_guard
  before insert or update on public.cargos
  for each row
  execute function private.guard_cargo();

create or replace function private.sync_classroom_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.classroom_id is not null then
      insert into public.classroom_members (user_id, classroom_id)
      values (new.id, new.classroom_id)
      on conflict do nothing;
    end if;
  elsif new.classroom_id is not null
        and new.classroom_id is distinct from old.classroom_id then
    insert into public.classroom_members (user_id, classroom_id)
    values (new.id, new.classroom_id)
    on conflict do nothing;
  end if;

  return new;
end;
$$;

create trigger profiles_sync_classroom_member
  after insert or update of classroom_id on public.profiles
  for each row
  execute function private.sync_classroom_member();

-- ---------------------------------------------------------------------------
-- Empresa personal o de equipo
-- ---------------------------------------------------------------------------

alter table public.companies drop constraint companies_owner_id_key;
alter table public.companies alter column owner_id drop not null;
alter table public.companies alter column razon drop not null;
alter table public.companies alter column nit drop not null;
alter table public.companies alter column work_date drop not null;
alter table public.companies alter column accounting_start drop not null;
alter table public.companies alter column resol_numero drop not null;
alter table public.companies alter column resol_fecha drop not null;
alter table public.companies alter column banco_nombre drop not null;
alter table public.companies alter column banco_cuenta drop not null;
alter table public.companies alter column banco_cheque_ini drop not null;

alter table public.companies
  add column kind text not null default 'personal',
  add column student_id uuid references public.profiles (id) on delete cascade,
  add column completed boolean not null default false;

update public.companies
set kind = 'personal',
    student_id = owner_id,
    completed = true
where true;

alter table public.companies
  add constraint companies_kind_ok check (kind in ('personal', 'equipo')),
  add constraint companies_kind_student check (
    (kind = 'personal' and student_id is not null)
    or (kind = 'equipo' and student_id is null)
  ),
  add constraint companies_completed_ok check (
    not completed
    or (
      razon is not null
      and nit is not null
      and work_date is not null
      and accounting_start is not null
      and resol_numero is not null
      and resol_fecha is not null
      and banco_nombre is not null
      and banco_cuenta is not null
      and banco_cheque_ini is not null
    )
  );

create unique index companies_personal_student_classroom_uidx
  on public.companies (student_id, classroom_id)
  where kind = 'personal';

create index companies_student_id_idx on public.companies (student_id);

comment on column public.companies.kind is
  'personal: una por alumno y aula, cuenta para la nota y la ruta. equipo: ejercicio aparte.';

comment on column public.companies.student_id is
  'Alumno de la empresa personal. En la de equipo queda vacío.';

comment on column public.companies.owner_id is
  'Se conserva como el alumno de la personal. Ya no autoriza.';

comment on column public.companies.completed is
  'Falsa mientras falta razón social, NIT, saldos y el asiento de apertura.';

-- El aula de la empresa no sigue al perfil: una persona puede tener una
-- personal en cada aula, y los cargos pertenecen al aula de la empresa.
create or replace function private.sync_company_classroom()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  return new;
end;
$$;

create or replace function private.protect_company()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id
       or new.owner_id is distinct from old.owner_id
       or new.kind is distinct from old.kind
       or new.student_id is distinct from old.student_id then
      raise exception 'No está permitido cambiar el tipo de la empresa';
    end if;

    if new.classroom_id is distinct from old.classroom_id
       and not private.bypass_guard() then
      raise exception 'No está permitido mover la empresa de aula';
    end if;

    if old.completed and not new.completed
       and not private.bypass_guard()
       and not private.is_admin() then
      raise exception 'La empresa ya está completa';
    end if;

    if new.completed and not old.completed and not exists (
      select 1
      from public.documentos
      where company_id = new.id
        and tipo = 'INI'
    ) then
      raise exception 'La empresa aún no tiene el asiento de apertura';
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Membresía y acciones
-- ---------------------------------------------------------------------------

create table public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  cargo_id uuid not null references public.cargos (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (company_id, user_id, cargo_id)
);

comment on table public.company_members is
  'Lugar de un alumno en una empresa: la persona y el cargo que eligió. Puede haber varios cargos.';

create index company_members_company_id_idx on public.company_members (company_id);
create index company_members_user_id_idx on public.company_members (user_id);
create index company_members_cargo_id_idx on public.company_members (cargo_id);

create table public.company_member_actions (
  member_id uuid not null references public.company_members (id) on delete cascade,
  action text not null,
  level text not null check (level in ('do', 'view', 'hide')),
  primary key (member_id, action),
  constraint company_member_actions_action_ok check (action in (
    'company.edit',
    'terceros.write',
    'productos.write',
    'pos.write',
    'fe.write',
    'rc.write',
    'fc.write',
    'ce.write',
    'caja.write',
    'banco.write',
    'nc.write',
    'books.read',
    'files.write',
    'document.void',
    'company.delete'
  ))
);

comment on table public.company_member_actions is
  'Hacer, ver o no ver, por membresía. No vive en el cargo.';

create or replace function private.seed_member_actions(member uuid, cargo uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  cargo_name text;
  only_label boolean;
  act text;
  lvl text;
  actions text[] := array[
    'company.edit', 'terceros.write', 'productos.write', 'pos.write', 'fe.write',
    'rc.write', 'fc.write', 'ce.write', 'caja.write', 'banco.write', 'nc.write',
    'books.read', 'files.write', 'document.void', 'company.delete'
  ];
  -- El auditor consulta los libros y los soportes. No registra ni borra.
  consult text[] := array['books.read', 'files.write'];
begin
  select name, label_only into cargo_name, only_label
  from public.cargos
  where id = cargo;

  delete from public.company_member_actions where member_id = member;

  foreach act in array actions loop
    if lower(cargo_name) = 'auditor' or not only_label then
      lvl := case when act = any (consult) then 'view' else 'hide' end;
    else
      lvl := case when act = 'company.delete' then 'hide' else 'do' end;
    end if;

    insert into public.company_member_actions (member_id, action, level)
    values (member, act, lvl);
  end loop;
end;
$$;

create or replace function private.reseed_member_actions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.seed_member_actions(new.id, new.cargo_id);
  elsif new.cargo_id is distinct from old.cargo_id then
    perform private.seed_member_actions(new.id, new.cargo_id);
  end if;

  return null;
end;
$$;

create trigger company_members_seed_actions
  after insert or update of cargo_id on public.company_members
  for each row
  execute function private.reseed_member_actions();

create or replace function private.guard_company_member()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.profiles
    where id = new.user_id
      and role = 'student'
  ) then
    raise exception 'Únicamente un alumno entra a la empresa';
  end if;

  if not exists (
    select 1
    from public.cargos g
    join public.companies c on c.classroom_id = g.classroom_id
    where g.id = new.cargo_id
      and c.id = new.company_id
  ) then
    raise exception 'Ese cargo no está en el aula';
  end if;

  if not exists (
    select 1
    from public.classroom_members m
    join public.companies c on c.classroom_id = m.classroom_id
    where m.user_id = new.user_id
      and c.id = new.company_id
  ) then
    raise exception 'El alumno no está en el aula de la empresa';
  end if;

  if tg_op = 'UPDATE' then
    if new.company_id is distinct from old.company_id
       or new.user_id is distinct from old.user_id then
      raise exception 'No se puede mover la membresía';
    end if;

    new.created_at := old.created_at;

    if new.cargo_id is distinct from old.cargo_id
       and not private.bypass_guard()
       and not private.is_admin()
       and old.user_id is distinct from (select auth.uid()) then
      raise exception 'No está permitido cambiar ese cargo';
    end if;
  end if;

  return new;
end;
$$;

create trigger company_members_guard
  before insert or update on public.company_members
  for each row
  execute function private.guard_company_member();

-- ---------------------------------------------------------------------------
-- Autor del documento e historial
-- ---------------------------------------------------------------------------

alter table public.documentos
  add column created_by uuid references public.profiles (id) on delete set null,
  add column cargo_id uuid references public.cargos (id) on delete set null;

comment on column public.documentos.created_by is
  'Quien creó el documento. No cambia si otro lo corrige.';

comment on column public.documentos.cargo_id is
  'Cargo con el que quedó firmado. No cambia si otro lo corrige.';

create index documentos_created_by_idx on public.documentos (created_by);
create index documentos_cargo_id_idx on public.documentos (cargo_id);

create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  cargo_id uuid references public.cargos (id) on delete set null,
  classroom_id uuid references public.classrooms (id) on delete cascade,
  company_id uuid references public.companies (id) on delete cascade,
  document_id uuid references public.documentos (id) on delete cascade,
  action text not null check (action in ('crear', 'corregir', 'anular')),
  at timestamptz not null default now()
);

comment on table public.activity_events is
  'Historial de cada alumno. La empresa o el documento lo borran en cascada; el usuario no.';

create index activity_events_actor_id_idx on public.activity_events (actor_id, at desc);
create index activity_events_company_id_idx on public.activity_events (company_id, at desc);
create index activity_events_document_id_idx on public.activity_events (document_id);

create or replace function private.documento_action(tipo text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case tipo
    when 'INI' then 'company.edit'
    when 'FE' then 'fe.write'
    when 'POS' then 'pos.write'
    when 'RC' then 'rc.write'
    when 'FC' then 'fc.write'
    when 'CE' then 'ce.write'
    when 'CG' then 'caja.write'
    when 'NC' then 'nc.write'
    when 'AQ' then 'caja.write'
    when 'EXT' then 'banco.write'
    when 'CON' then 'banco.write'
    when 'MAIL' then 'files.write'
    when 'ARC' then 'files.write'
    else 'books.read'
  end
$$;

create or replace function private.action_level(company uuid, act text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when bool_or(a.level = 'do') then 'do'
    when bool_or(a.level = 'view') then 'view'
    else 'hide'
  end
  from public.company_members m
  join public.company_member_actions a on a.member_id = m.id
  where m.company_id = company
    and m.user_id = (select auth.uid())
    and a.action = act
$$;

create or replace function private.can_do(company uuid, act text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.is_admin())
    or private.action_level(company, act) = 'do'
$$;

create or replace function private.can_see(company uuid, act text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.is_admin())
    or private.action_level(company, act) in ('do', 'view')
$$;

create or replace function private.stamp_documento_author()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if tg_op = 'INSERT' then
    if new.created_by is null or (uid is not null and not private.is_admin() and not private.bypass_guard()) then
      new.created_by := uid;
    end if;

    if new.cargo_id is null and new.created_by is not null then
      select m.cargo_id into new.cargo_id
      from public.company_members m
      join public.company_member_actions a on a.member_id = m.id
      where m.company_id = new.company_id
        and m.user_id = new.created_by
        and a.action = private.documento_action(new.tipo)
        and a.level = 'do'
      limit 1;

      if new.cargo_id is null then
        select m.cargo_id into new.cargo_id
        from public.company_members m
        where m.company_id = new.company_id
          and m.user_id = new.created_by
        limit 1;
      end if;
    end if;

    return new;
  end if;

  if (new.created_by is distinct from old.created_by or new.cargo_id is distinct from old.cargo_id)
     and uid is not null
     and not private.bypass_guard() then
    raise exception 'No está permitido cambiar el autor ni el cargo';
  end if;

  if uid is not null and not private.is_admin() and not private.bypass_guard() then
    if new.anulado is distinct from old.anulado
       or new.anulado_en is distinct from old.anulado_en then
      if not private.can_do(new.company_id, 'document.void') then
        raise exception 'No está permitido anular este documento';
      end if;
    end if;

    if new.company_id is distinct from old.company_id
       or new.tipo is distinct from old.tipo
       or new.num is distinct from old.num
       or new.fecha is distinct from old.fecha
       or new.ts is distinct from old.ts
       or new.tercero_id is distinct from old.tercero_id
       or new.medio is distinct from old.medio
       or new.extra is distinct from old.extra then
      if not private.can_do(new.company_id, private.documento_action(coalesce(old.tipo, new.tipo))) then
        raise exception 'No está permitido corregir este documento';
      end if;
    end if;
  end if;

  return new;
end;
$$;

create trigger documentos_stamp_author
  before insert or update on public.documentos
  for each row
  execute function private.stamp_documento_author();

create or replace function private.guard_linea_permiso()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  company uuid;
  tipo text;
  doc uuid;
begin
  if (select auth.uid()) is null
     or private.is_admin()
     or private.bypass_guard() then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  doc := case when tg_op = 'DELETE' then old.documento_id else new.documento_id end;

  select d.company_id, d.tipo into company, tipo
  from public.documentos d
  where d.id = doc;

  if not private.can_do(company, private.documento_action(tipo)) then
    raise exception 'No está permitido corregir este asiento';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create trigger lineas_permiso
  before update or delete on public.lineas_asiento
  for each row
  execute function private.guard_linea_permiso();

create or replace function private.log_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  company uuid;
  room uuid;
  cargo uuid;
  document uuid;
  verb text;
begin
  if uid is null then
    return null;
  end if;

  if tg_table_name = 'documentos' then
    company := new.company_id;
    document := new.id;
    if tg_op = 'INSERT' then
      verb := 'crear';
    elsif new.anulado and not old.anulado then
      verb := 'anular';
    else
      verb := 'corregir';
    end if;
  else
    document := new.documento_id;
    select d.company_id into company
    from public.documentos d
    where d.id = document;
    verb := 'corregir';
  end if;

  select c.classroom_id into room
  from public.companies c
  where c.id = company;

  select m.cargo_id into cargo
  from public.company_members m
  join public.company_member_actions a on a.member_id = m.id
  where m.company_id = company
    and m.user_id = uid
    and a.level = 'do'
  limit 1;

  if cargo is null then
    select m.cargo_id into cargo
    from public.company_members m
    where m.company_id = company
      and m.user_id = uid
    limit 1;
  end if;

  insert into public.activity_events (
    actor_id, cargo_id, classroom_id, company_id, document_id, action
  ) values (
    uid, cargo, room, company, document, verb
  );

  return null;
end;
$$;

create trigger documentos_log
  after insert or update on public.documentos
  for each row
  execute function private.log_activity();

create trigger lineas_log
  after update on public.lineas_asiento
  for each row
  execute function private.log_activity();

-- ---------------------------------------------------------------------------
-- Empresas ya guardadas
-- ---------------------------------------------------------------------------

insert into public.classroom_members (user_id, classroom_id)
select id, classroom_id
from public.profiles
where classroom_id is not null
on conflict do nothing;

insert into public.classroom_members (user_id, classroom_id)
select owner_id, classroom_id
from public.companies
where owner_id is not null
on conflict do nothing;

insert into public.cargos (classroom_id, name, label_only)
select rooms.id, seed.name, seed.label_only
from public.classrooms rooms
cross join (
  values
    ('auxiliar contable', true),
    ('contador', true),
    ('administrador', true),
    ('auditor', false)
) as seed(name, label_only)
on conflict (classroom_id, name) do nothing;

insert into public.company_members (company_id, user_id, cargo_id)
select c.id, c.owner_id, g.id
from public.companies c
join public.cargos g
  on g.classroom_id = c.classroom_id
 and g.name = 'contador'
where c.owner_id is not null
on conflict do nothing;

update public.documentos d
set created_by = c.owner_id,
    cargo_id = (
      select m.cargo_id
      from public.company_members m
      where m.company_id = c.id
        and m.user_id = c.owner_id
      limit 1
    )
from public.companies c
where d.company_id = c.id
  and d.created_by is null
  and c.owner_id is not null;

-- ---------------------------------------------------------------------------
-- Empresas vacías y completar la que ya existe
-- ---------------------------------------------------------------------------

create or replace function public.crear_empresa_vacia(
  p_classroom uuid,
  p_kind text,
  p_student uuid
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_id uuid;
begin
  if not private.is_admin() then
    raise exception 'Únicamente el docente crea la empresa';
  end if;

  if p_kind not in ('personal', 'equipo') then
    raise exception 'Esa clase de empresa no está permitida';
  end if;

  if not exists (select 1 from public.classrooms where id = p_classroom) then
    raise exception 'El aula no está disponible';
  end if;

  if p_kind = 'personal' then
    if p_student is null then
      raise exception 'La empresa personal aún no tiene alumno';
    end if;

    if not exists (
      select 1 from public.profiles
      where id = p_student and role = 'student'
    ) then
      raise exception 'Esa cuenta no está registrada como alumno';
    end if;

    if not exists (
      select 1 from public.classroom_members
      where user_id = p_student and classroom_id = p_classroom
    ) then
      raise exception 'El alumno no está en el aula';
    end if;

    if exists (
      select 1 from public.companies
      where student_id = p_student
        and classroom_id = p_classroom
        and kind = 'personal'
    ) then
      raise exception 'Ese alumno ya está en una empresa personal del aula';
    end if;
  else
    p_student := null;
  end if;

  insert into public.companies (
    owner_id, student_id, classroom_id, kind, completed, razon, nit
  ) values (
    p_student,
    p_student,
    p_classroom,
    p_kind,
    false,
    null,
    null
  )
  returning id into new_id;

  return new_id;
end;
$$;

create or replace function public.completar_empresa(p_company uuid, payload jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  kind text;
  student uuid;
  done boolean;
  inicio date;
  item jsonb;
  caja bigint;
  banco bigint;
  inv bigint;
  total bigint;
  orden integer := 0;
  doc_id uuid;
  terceros jsonb := coalesce(payload -> 'terceros', '[]'::jsonb);
  productos jsonb := coalesce(payload -> 'productos', '[]'::jsonb);
begin
  if uid is null then
    raise exception 'Inicia sesión para completar la empresa';
  end if;

  if jsonb_typeof(terceros) is distinct from 'array'
     or jsonb_typeof(productos) is distinct from 'array'
     or jsonb_array_length(terceros) > 30
     or jsonb_array_length(productos) > 40 then
    raise exception 'El catálogo de la empresa no es válido';
  end if;

  select c.kind, c.student_id, c.completed
  into kind, student, done
  from public.companies c
  where c.id = p_company;

  if kind is null then
    raise exception 'La empresa no está disponible';
  end if;

  if done then
    raise exception 'Esta empresa ya está completa';
  end if;

  if not private.can_do(p_company, 'company.edit') then
    raise exception 'No está permitido completar esta empresa';
  end if;

  if kind = 'personal' and uid is distinct from student and not private.is_admin() then
    raise exception 'Únicamente su alumno completa la empresa personal';
  end if;

  if nullif(btrim(payload ->> 'razon'), '') is null
     or nullif(btrim(payload ->> 'nit'), '') is null then
    raise exception 'Escribe la razón social y el NIT';
  end if;

  inicio := (payload ->> 'accounting_start')::date;
  caja := greatest(coalesce((payload ->> 'caja')::bigint, 0), 0);
  banco := greatest(coalesce((payload ->> 'banco_saldo0')::bigint, 0), 0);

  if nullif(btrim(payload ->> 'full_name'), '') is not null then
    update public.profiles
    set full_name = btrim(payload ->> 'full_name')
    where id = uid;
  end if;

  update public.companies
  set razon = btrim(payload ->> 'razon'),
      nit = btrim(payload ->> 'nit'),
      ciudad = coalesce(btrim(payload ->> 'ciudad'), ''),
      direccion = coalesce(btrim(payload ->> 'direccion'), ''),
      work_date = coalesce((payload ->> 'work_date')::date, inicio),
      accounting_start = inicio,
      resol_numero = btrim(payload ->> 'resol_numero'),
      resol_fecha = (payload ->> 'resol_fecha')::date,
      resol_prefijo = coalesce(nullif(btrim(payload ->> 'resol_prefijo'), ''), 'FE'),
      resol_desde = coalesce((payload ->> 'resol_desde')::integer, 1),
      resol_hasta = coalesce((payload ->> 'resol_hasta')::integer, 5000),
      banco_nombre = coalesce(nullif(btrim(payload ->> 'banco_nombre'), ''), 'Banco del Altiplano'),
      banco_cuenta = btrim(payload ->> 'banco_cuenta'),
      banco_cheque_ini = (payload ->> 'banco_cheque_ini')::integer,
      banco_saldo0 = banco
  where id = p_company;

  for item in select value from jsonb_array_elements(terceros)
  loop
    insert into public.terceros (company_id, tipo_doc, doc, nombre, rol, correo)
    values (
      p_company,
      item ->> 'tipo_doc',
      btrim(item ->> 'doc'),
      btrim(item ->> 'nombre'),
      item ->> 'rol',
      coalesce(btrim(item ->> 'correo'), '')
    );
  end loop;

  for item in select value from jsonb_array_elements(productos)
  loop
    insert into public.productos (company_id, cod, nombre, precio, iva, costo0, stock0)
    values (
      p_company,
      btrim(item ->> 'cod'),
      btrim(item ->> 'nombre'),
      (item ->> 'precio')::bigint,
      (item ->> 'iva')::smallint,
      (item ->> 'costo0')::bigint,
      (item ->> 'stock0')::numeric
    );
  end loop;

  select coalesce(sum(round(stock0 * costo0)), 0)::bigint
  into inv
  from public.productos
  where company_id = p_company;

  total := caja + banco + inv;
  if total <= 0 then
    raise exception 'Aún falta un saldo inicial';
  end if;

  insert into public.documentos (company_id, tipo, num, fecha, extra)
  values (p_company, 'INI', 0, inicio, '{}'::jsonb)
  returning id into doc_id;

  if caja > 0 then
    insert into public.lineas_asiento (documento_id, orden, cuenta, debito, credito, detalle)
    values (doc_id, orden, '1105', caja, 0, 'Saldo inicial de caja');
    orden := orden + 1;
  end if;

  if banco > 0 then
    insert into public.lineas_asiento (documento_id, orden, cuenta, debito, credito, detalle)
    values (doc_id, orden, '1110', banco, 0, 'Saldo inicial en bancos');
    orden := orden + 1;
  end if;

  if inv > 0 then
    insert into public.lineas_asiento (documento_id, orden, cuenta, debito, credito, detalle)
    values (doc_id, orden, '1435', inv, 0, 'Inventario inicial de mercancías');
    orden := orden + 1;
  end if;

  insert into public.lineas_asiento (documento_id, orden, cuenta, debito, credito, detalle)
  values (doc_id, orden, '3105', 0, total, 'Aportes de los socios');

  update public.companies
  set completed = true,
      resumen = jsonb_build_object(
        'docs', 1,
        'ventas', 0,
        'arqueos', jsonb_build_array(0, 0),
        'concil', '[]'::jsonb,
        'ultima', to_jsonb(now())
      )
  where id = p_company;

  return p_company;
end;
$$;

create or replace function public.crear_empresa(payload jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'La empresa la crea el docente. Completa la empresa vacía.';
end;
$$;

comment on function public.crear_empresa_vacia(uuid, text, uuid) is
  'El docente crea una empresa vacía, personal o de equipo. No escribe saldos ni asiento.';

comment on function public.completar_empresa(uuid, jsonb) is
  'Completa una empresa vacía: catálogo y asiento de apertura. Exige company.edit en hacer.';

comment on function public.crear_empresa(jsonb) is
  'Ya no crea la empresa. El docente la deja vacía y el alumno la completa.';

-- ---------------------------------------------------------------------------
-- Archivos: ver o escribir según files.write. Borrar la empresa no los toca.
-- ---------------------------------------------------------------------------

create or replace function private.object_company(object_name text)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  company uuid;
begin
  begin
    company := (storage.foldername(object_name))[1]::uuid;
  exception
    when invalid_text_representation then
      return null;
  end;

  return company;
end;
$$;

create or replace function private.owns_object_company(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_see(private.object_company(object_name), 'files.write')
$$;

revoke all on function private.object_company(text) from public;
grant execute on function private.object_company(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Privilegios
-- ---------------------------------------------------------------------------

revoke all on table public.classroom_members from public, anon, authenticated;
revoke all on table public.cargos from public, anon, authenticated;
revoke all on table public.company_members from public, anon, authenticated;
revoke all on table public.company_member_actions from public, anon, authenticated;
revoke all on table public.activity_events from public, anon, authenticated;

grant select, insert, delete on table public.classroom_members to authenticated;
grant select, insert, update, delete on table public.cargos to authenticated;
grant select, insert, update, delete on table public.company_members to authenticated;
grant select, update on table public.company_member_actions to authenticated;
grant select on table public.activity_events to authenticated;

grant select, insert, update, delete on table public.classroom_members to service_role;
grant select, insert, update, delete on table public.cargos to service_role;
grant select, insert, update, delete on table public.company_members to service_role;
grant select, insert, update, delete on table public.company_member_actions to service_role;
grant select, insert, update, delete on table public.activity_events to service_role;

revoke all on function private.seed_classroom_cargos() from public;
revoke all on function private.guard_cargo() from public;
revoke all on function private.sync_classroom_member() from public;
revoke all on function private.seed_member_actions(uuid, uuid) from public;
revoke all on function private.reseed_member_actions() from public;
revoke all on function private.guard_company_member() from public;
revoke all on function private.stamp_documento_author() from public;
revoke all on function private.guard_linea_permiso() from public;
revoke all on function private.log_activity() from public;
revoke all on function private.documento_action(text) from public;
revoke all on function private.action_level(uuid, text) from public;
revoke all on function private.can_do(uuid, text) from public;
revoke all on function private.can_see(uuid, text) from public;

grant execute on function private.documento_action(text) to authenticated;
grant execute on function private.action_level(uuid, text) to authenticated;
grant execute on function private.can_do(uuid, text) to authenticated;
grant execute on function private.can_see(uuid, text) to authenticated;

revoke all on function public.crear_empresa_vacia(uuid, text, uuid) from public, anon;
revoke all on function public.completar_empresa(uuid, jsonb) from public, anon;
grant execute on function public.crear_empresa_vacia(uuid, text, uuid) to authenticated;
grant execute on function public.completar_empresa(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Políticas
-- ---------------------------------------------------------------------------

alter table public.classroom_members enable row level security;
alter table public.cargos enable row level security;
alter table public.company_members enable row level security;
alter table public.company_member_actions enable row level security;
alter table public.activity_events enable row level security;

drop policy if exists classrooms_select_auth on public.classrooms;
create policy classrooms_select_auth
  on public.classrooms
  for select
  to authenticated
  using (
    active
    or (select private.is_admin())
    or id in (
      select classroom_id from public.profiles where id = (select auth.uid())
    )
    or id in (
      select classroom_id from public.classroom_members where user_id = (select auth.uid())
    )
  );

create policy classroom_members_select
  on public.classroom_members
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.is_admin())
  );

create policy classroom_members_insert
  on public.classroom_members
  for insert
  to authenticated
  with check ((select private.is_admin()));

create policy classroom_members_delete
  on public.classroom_members
  for delete
  to authenticated
  using ((select private.is_admin()));

create policy cargos_select
  on public.cargos
  for select
  to authenticated
  using (
    (select private.is_admin())
    or classroom_id in (
      select classroom_id from public.classroom_members where user_id = (select auth.uid())
    )
  );

create policy cargos_write
  on public.cargos
  for all
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy company_members_select
  on public.company_members
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.is_admin())
    or (select private.can_see(company_id, 'books.read'))
  );

create policy company_members_insert
  on public.company_members
  for insert
  to authenticated
  with check ((select private.is_admin()));

create policy company_members_update
  on public.company_members
  for update
  to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.is_admin())
  )
  with check (
    user_id = (select auth.uid())
    or (select private.is_admin())
  );

create policy company_members_delete
  on public.company_members
  for delete
  to authenticated
  using ((select private.is_admin()));

create policy company_member_actions_select
  on public.company_member_actions
  for select
  to authenticated
  using (
    (select private.is_admin())
    or exists (
      select 1
      from public.company_members m
      where m.id = member_id
        and m.user_id = (select auth.uid())
    )
  );

create policy company_member_actions_update
  on public.company_member_actions
  for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy activity_select
  on public.activity_events
  for select
  to authenticated
  using (
    (select private.is_admin())
    or actor_id = (select auth.uid())
  );

drop policy if exists companies_select on public.companies;
drop policy if exists companies_insert on public.companies;
drop policy if exists companies_update on public.companies;
drop policy if exists companies_delete_admin on public.companies;

create policy companies_select
  on public.companies
  for select
  to authenticated
  using (
    (select private.is_admin())
    or exists (
      select 1
      from public.company_members m
      join public.company_member_actions a on a.member_id = m.id
      where m.company_id = companies.id
        and m.user_id = (select auth.uid())
        and a.level in ('do', 'view')
    )
  );

create policy companies_insert
  on public.companies
  for insert
  to authenticated
  with check ((select private.is_admin()));

create policy companies_update
  on public.companies
  for update
  to authenticated
  using (
    (select private.is_admin())
    or (select private.can_do(id, 'company.edit'))
  )
  with check (
    (select private.is_admin())
    or (select private.can_do(id, 'company.edit'))
  );

create policy companies_delete
  on public.companies
  for delete
  to authenticated
  using (
    (select private.is_admin())
    or (select private.can_do(id, 'company.delete'))
  );

drop policy if exists terceros_select on public.terceros;
drop policy if exists terceros_insert on public.terceros;
drop policy if exists terceros_update on public.terceros;
drop policy if exists terceros_delete on public.terceros;

create policy terceros_select
  on public.terceros
  for select
  to authenticated
  using (
    (select private.can_see(company_id, 'terceros.write'))
    or (select private.can_see(company_id, 'books.read'))
    or (
      (select private.can_do(company_id, 'company.edit'))
      and exists (
        select 1 from public.companies c
        where c.id = company_id and not c.completed
      )
    )
  );

create policy terceros_insert
  on public.terceros
  for insert
  to authenticated
  with check (
    (select private.can_do(company_id, 'terceros.write'))
    or (
      (select private.can_do(company_id, 'company.edit'))
      and exists (
        select 1 from public.companies c
        where c.id = company_id and not c.completed
      )
    )
  );

create policy terceros_update
  on public.terceros
  for update
  to authenticated
  using ((select private.can_do(company_id, 'terceros.write')))
  with check ((select private.can_do(company_id, 'terceros.write')));

create policy terceros_delete
  on public.terceros
  for delete
  to authenticated
  using (
    (select private.is_admin())
    or (select private.can_do(company_id, 'terceros.write'))
  );

drop policy if exists productos_select on public.productos;
drop policy if exists productos_insert on public.productos;
drop policy if exists productos_update on public.productos;
drop policy if exists productos_delete on public.productos;

create policy productos_select
  on public.productos
  for select
  to authenticated
  using (
    (select private.can_see(company_id, 'productos.write'))
    or (select private.can_see(company_id, 'books.read'))
    or (
      (select private.can_do(company_id, 'company.edit'))
      and exists (
        select 1 from public.companies c
        where c.id = company_id and not c.completed
      )
    )
  );

create policy productos_insert
  on public.productos
  for insert
  to authenticated
  with check (
    (select private.can_do(company_id, 'productos.write'))
    or (
      (select private.can_do(company_id, 'company.edit'))
      and exists (
        select 1 from public.companies c
        where c.id = company_id and not c.completed
      )
    )
  );

create policy productos_update
  on public.productos
  for update
  to authenticated
  using ((select private.can_do(company_id, 'productos.write')))
  with check ((select private.can_do(company_id, 'productos.write')));

create policy productos_delete
  on public.productos
  for delete
  to authenticated
  using (
    (select private.is_admin())
    or (select private.can_do(company_id, 'productos.write'))
  );

drop policy if exists documentos_select on public.documentos;
drop policy if exists documentos_insert on public.documentos;
drop policy if exists documentos_update on public.documentos;
drop policy if exists documentos_delete on public.documentos;

create policy documentos_select
  on public.documentos
  for select
  to authenticated
  using (
    (select private.can_see(company_id, private.documento_action(tipo)))
    or (select private.can_see(company_id, 'books.read'))
  );

create policy documentos_insert
  on public.documentos
  for insert
  to authenticated
  with check (
    (select private.can_do(company_id, private.documento_action(tipo)))
  );

create policy documentos_update
  on public.documentos
  for update
  to authenticated
  using (
    (select private.can_do(company_id, private.documento_action(tipo)))
    or (select private.can_do(company_id, 'document.void'))
  )
  with check (
    (select private.can_do(company_id, private.documento_action(tipo)))
    or (select private.can_do(company_id, 'document.void'))
  );

create policy documentos_delete
  on public.documentos
  for delete
  to authenticated
  using (
    (select private.is_admin())
    or (select private.can_do(company_id, private.documento_action(tipo)))
  );

drop policy if exists lineas_select on public.lineas_asiento;
drop policy if exists lineas_insert on public.lineas_asiento;
drop policy if exists lineas_update on public.lineas_asiento;
drop policy if exists lineas_delete on public.lineas_asiento;

create policy lineas_select
  on public.lineas_asiento
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.documentos d
      where d.id = documento_id
        and (
          (select private.can_see(d.company_id, private.documento_action(d.tipo)))
          or (select private.can_see(d.company_id, 'books.read'))
        )
    )
  );

create policy lineas_insert
  on public.lineas_asiento
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.documentos d
      where d.id = documento_id
        and (select private.can_do(d.company_id, private.documento_action(d.tipo)))
    )
  );

create policy lineas_update
  on public.lineas_asiento
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.documentos d
      where d.id = documento_id
        and (select private.can_do(d.company_id, private.documento_action(d.tipo)))
    )
  )
  with check (
    exists (
      select 1
      from public.documentos d
      where d.id = documento_id
        and (select private.can_do(d.company_id, private.documento_action(d.tipo)))
    )
  );

create policy lineas_delete
  on public.lineas_asiento
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.documentos d
      where d.id = documento_id
        and (
          (select private.is_admin())
          or (select private.can_do(d.company_id, private.documento_action(d.tipo)))
        )
    )
  );

drop policy if exists items_select on public.documento_items;
drop policy if exists items_insert on public.documento_items;
drop policy if exists items_update on public.documento_items;
drop policy if exists items_delete on public.documento_items;

create policy items_select
  on public.documento_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.documentos d
      where d.id = documento_id
        and (
          (select private.can_see(d.company_id, private.documento_action(d.tipo)))
          or (select private.can_see(d.company_id, 'books.read'))
        )
    )
  );

create policy items_insert
  on public.documento_items
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.documentos d
      where d.id = documento_id
        and (select private.can_do(d.company_id, private.documento_action(d.tipo)))
    )
  );

create policy items_update
  on public.documento_items
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.documentos d
      where d.id = documento_id
        and (select private.can_do(d.company_id, private.documento_action(d.tipo)))
    )
  )
  with check (
    exists (
      select 1
      from public.documentos d
      where d.id = documento_id
        and (select private.can_do(d.company_id, private.documento_action(d.tipo)))
    )
  );

create policy items_delete
  on public.documento_items
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.documentos d
      where d.id = documento_id
        and (
          (select private.is_admin())
          or (select private.can_do(d.company_id, private.documento_action(d.tipo)))
        )
    )
  );

create policy profiles_select_teammates
  on public.profiles
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.company_members mine
      join public.company_members theirs on theirs.company_id = mine.company_id
      where mine.user_id = (select auth.uid())
        and theirs.user_id = profiles.id
    )
  );

drop policy if exists soportes_select on storage.objects;
drop policy if exists soportes_insert on storage.objects;
drop policy if exists soportes_update on storage.objects;
drop policy if exists soportes_delete on storage.objects;

create policy soportes_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'soportes'
    and (select private.can_see(private.object_company(name), 'files.write'))
  );

create policy soportes_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'soportes'
    and coalesce(array_length(storage.foldername(name), 1), 0) >= 2
    and (select private.can_do(private.object_company(name), 'files.write'))
  );

create policy soportes_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'soportes'
    and (select private.can_do(private.object_company(name), 'files.write'))
  )
  with check (
    bucket_id = 'soportes'
    and coalesce(array_length(storage.foldername(name), 1), 0) >= 2
    and (select private.can_do(private.object_company(name), 'files.write'))
  );

create policy soportes_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'soportes'
    and (select private.can_do(private.object_company(name), 'files.write'))
  );
