-- Laboratorio Contable
-- Replaces browser storage (localStorage key lab_empresa_v1, IndexedDB lab_files)
-- and the old document collections empresas/{uid} and empresas/{uid}/t/{id}.
--
-- Books, inventory, and receivables stay computed in the app from lineas_asiento
-- and documento_items, the same way compute() does today.
--
-- Role is a column on profiles. It is never read from user metadata.

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated, supabase_auth_admin;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Invoker on purpose: inside a security definer function current_user is the
-- owner, so this check would always pass.
create or replace function private.bypass_guard()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select current_user in ('postgres', 'supabase_admin')
    or coalesce(auth.role(), '') = 'service_role';
$$;

revoke all on function private.bypass_guard() from public;
grant execute on function private.bypass_guard() to authenticated;

-- ---------------------------------------------------------------------------
-- Classrooms and profiles
-- ---------------------------------------------------------------------------

create table public.classrooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  semester text not null,
  active boolean not null default true,
  arqueo_dif boolean not null default true,
  mensaje text not null default '',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.classrooms is
  'Aulas que crea el docente. El estudiante elige una activa al registrarse. arqueo_dif y mensaje reemplazan el documento config/lab, ahora por aula.';

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'student' check (role in ('admin', 'student')),
  full_name text not null default '',
  classroom_id uuid references public.classrooms (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.profiles is
  'Una fila por usuario de Auth. Los usuarios nuevos son student. classroom_id lo fija el registro y después solo el docente.';

create index profiles_classroom_id_idx on public.profiles (classroom_id);

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to authenticated;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  chosen uuid;
begin
  chosen := null;

  if new.raw_user_meta_data is not null
     and nullif(new.raw_user_meta_data ->> 'classroom_id', '') is not null then
    begin
      chosen := (new.raw_user_meta_data ->> 'classroom_id')::uuid;
    exception
      when invalid_text_representation then
        chosen := null;
    end;

    if not exists (
      select 1
      from public.classrooms
      where id = chosen
        and active
    ) then
      chosen := null;
    end if;
  end if;

  insert into public.profiles (id, role, full_name, classroom_id)
  values (
    new.id,
    'student',
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), ''),
    chosen
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function private.handle_new_user();

create or replace function private.protect_profile()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.id is distinct from old.id then
    raise exception 'No se puede cambiar el identificador';
  end if;

  if new.role is distinct from old.role
     and not private.bypass_guard()
     and not private.is_admin() then
    raise exception 'No puedes cambiar el rol';
  end if;

  if new.classroom_id is distinct from old.classroom_id
     and old.classroom_id is not null
     and not private.bypass_guard()
     and not private.is_admin() then
    raise exception 'El aula solo la cambia el docente';
  end if;

  if new.classroom_id is not null and not exists (
    select 1
    from public.classrooms
    where id = new.classroom_id
      and (active or private.is_admin() or private.bypass_guard())
  ) then
    raise exception 'El aula no está disponible';
  end if;

  return new;
end;
$$;

create trigger profiles_protect
  before update on public.profiles
  for each row
  execute function private.protect_profile();

-- ---------------------------------------------------------------------------
-- Practice company (one per student) and its catalogs
-- ---------------------------------------------------------------------------

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles (id) on delete cascade,
  classroom_id uuid not null references public.classrooms (id) on delete restrict,
  razon text not null,
  nit text not null,
  ciudad text not null default '',
  direccion text not null default '',
  work_date date not null,
  accounting_start date not null,
  resol_numero text not null,
  resol_fecha date not null,
  resol_prefijo text not null default 'FE',
  resol_desde integer not null default 1,
  resol_hasta integer not null default 5000,
  banco_nombre text not null,
  banco_cuenta text not null,
  banco_cheque_ini integer not null,
  banco_saldo0 bigint not null default 0,
  resumen jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint companies_dates check (work_date >= accounting_start),
  constraint companies_resol_range check (resol_desde >= 1 and resol_hasta >= resol_desde),
  constraint companies_cheque check (banco_cheque_ini > 0),
  constraint companies_banco_saldo check (banco_saldo0 >= 0)
);

comment on table public.companies is
  'Reemplaza meta de la empresa. El nombre del estudiante vive en profiles. El aula de creación se copia aquí y sigue al aula del perfil si el docente lo reasigna.';

comment on column public.companies.resumen is
  'Lo mantiene la aplicación: {"docs":0,"ventas":0,"arqueos":[ok,total],"concil":[{"P":"2026-11","nota":4.5}],"ultima":"<iso>"}';

comment on column public.companies.banco_saldo0 is
  'Saldo inicial de bancos. El extracto lo usa como saldo anterior del primer mes; el asiento de apertura lo repite en la línea 1110.';

create index companies_classroom_id_idx on public.companies (classroom_id);

create or replace function private.owns_object_company(object_name text)
returns boolean
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
      return false;
  end;

  if company is null then
    return false;
  end if;

  return exists (
    select 1
    from public.companies
    where id = company
      and owner_id = (select auth.uid())
  );
end;
$$;

revoke all on function private.owns_object_company(text) from public;
grant execute on function private.owns_object_company(text) to authenticated;

create or replace function private.protect_company()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id or new.owner_id is distinct from old.owner_id then
      raise exception 'No se puede cambiar el dueño de la empresa';
    end if;

    if new.classroom_id is distinct from old.classroom_id
       and not private.bypass_guard()
       and not private.is_admin() then
      raise exception 'No puedes cambiar el aula de la empresa';
    end if;
  end if;

  return new;
end;
$$;

create trigger companies_protect
  before update on public.companies
  for each row
  execute function private.protect_company();

create or replace function private.sync_company_classroom()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.classroom_id is distinct from old.classroom_id
     and new.classroom_id is not null then
    update public.companies
    set classroom_id = new.classroom_id
    where owner_id = new.id;
  end if;

  return new;
end;
$$;

create trigger profiles_sync_company_classroom
  after update of classroom_id on public.profiles
  for each row
  execute function private.sync_company_classroom();

create table public.terceros (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  tipo_doc text not null check (tipo_doc in ('NIT', 'CC', 'CE')),
  doc text not null,
  nombre text not null,
  rol text not null check (rol in ('cliente', 'proveedor', 'ambos')),
  correo text not null default '',
  created_at timestamptz not null default now()
);

comment on table public.terceros is
  'Reemplaza meta.terceros. Consumidor final sigue siendo un tercero de la empresa.';

create index terceros_company_id_idx on public.terceros (company_id);

create table public.productos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  cod text not null,
  nombre text not null,
  precio bigint not null check (precio >= 0),
  iva smallint not null default 19 check (iva in (0, 5, 19)),
  costo0 bigint not null default 0 check (costo0 >= 0),
  stock0 numeric(18, 4) not null default 0 check (stock0 >= 0),
  created_at timestamptz not null default now(),
  unique (company_id, cod)
);

comment on table public.productos is
  'Reemplaza meta.productos. costo0 y stock0 son el inventario de apertura; el saldo vivo se calcula con las compras y las ventas.';

create index productos_company_id_idx on public.productos (company_id);

-- ---------------------------------------------------------------------------
-- Chart of accounts (PUC used by the lab)
-- ---------------------------------------------------------------------------

create table public.cuentas (
  codigo text primary key,
  nombre text not null,
  clase text not null check (clase in (
    'Activo', 'Pasivo', 'Patrimonio', 'Ingresos', 'Gastos', 'Costos de ventas'
  ))
);

comment on table public.cuentas is
  'Plan de cuentas de referencia del laboratorio (PUC, Decreto 2650 de 1993). Solo lectura.';

insert into public.cuentas (codigo, nombre, clase) values
  ('1105', 'Caja', 'Activo'),
  ('1110', 'Bancos', 'Activo'),
  ('1305', 'Clientes', 'Activo'),
  ('1355', 'Anticipo de impuestos y contribuciones', 'Activo'),
  ('1365', 'Cuentas por cobrar a trabajadores', 'Activo'),
  ('1435', 'Mercancías no fabricadas por la empresa', 'Activo'),
  ('1524', 'Equipo de oficina', 'Activo'),
  ('2205', 'Proveedores nacionales', 'Pasivo'),
  ('2335', 'Costos y gastos por pagar', 'Pasivo'),
  ('2365', 'Retención en la fuente', 'Pasivo'),
  ('2408', 'Impuesto sobre las ventas por pagar', 'Pasivo'),
  ('3105', 'Capital suscrito y pagado', 'Patrimonio'),
  ('4135', 'Comercio al por mayor y al por menor', 'Ingresos'),
  ('4175', 'Devoluciones en ventas (DB)', 'Ingresos'),
  ('4210', 'Ingresos financieros', 'Ingresos'),
  ('4295', 'Ingresos diversos', 'Ingresos'),
  ('5105', 'Gastos de personal', 'Gastos'),
  ('5115', 'Impuestos', 'Gastos'),
  ('5120', 'Arrendamientos', 'Gastos'),
  ('5135', 'Servicios', 'Gastos'),
  ('5145', 'Mantenimiento y reparaciones', 'Gastos'),
  ('5195', 'Diversos', 'Gastos'),
  ('5305', 'Gastos financieros', 'Gastos'),
  ('5315', 'Gastos extraordinarios', 'Gastos'),
  ('6135', 'Costo de ventas: comercio al por mayor y al por menor', 'Costos de ventas');

-- ---------------------------------------------------------------------------
-- Documents, journal lines, and item lines
-- ---------------------------------------------------------------------------

create table public.documentos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  tipo text not null check (tipo in (
    'INI', 'FE', 'POS', 'RC', 'FC', 'CE', 'CG', 'NC', 'AQ', 'EXT', 'CON', 'MAIL', 'ARC'
  )),
  num integer not null default 0 check (num >= 0),
  fecha date not null,
  ts timestamptz not null default now(),
  anulado boolean not null default false,
  anulado_en timestamptz,
  tercero_id uuid references public.terceros (id) on delete restrict,
  medio text check (medio is null or medio in (
    'efectivo', 'transferencia', 'tarjeta', 'credito', 'cheque'
  )),
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint documentos_anulado_en check (not anulado or anulado_en is not null)
);

comment on table public.documentos is
  'Un comprobante. Los campos que no son comunes van en extra. Ver el README para la forma de cada tipo.';

comment on column public.documentos.extra is
  'FE: pref, vence, cufe, base, iva, total, ret, neto, costo. POS: base, iva, total, ret, neto, costo, recibido, cambio. FC: fact_prov, ret_pct, base, iva, total, ret, neto, cheque. RC y CE: aplica_a, valor, cheque. CG: valor, ref. NC: concepto, origen. AQ: libros, real_total, real, conteo, contado, dif, cuenta, responsable, obs, acierto. EXT: periodo, saldo_ant, saldo_final, rows, incluye. CON: periodo, ans, res, sol, nota_id. MAIL: para, asunto, cuerpo, doc_id. ARC: nombre, mime, size, carpeta, desc, link, storage_path.';

create index documentos_company_fecha_idx on public.documentos (company_id, fecha, ts);
create index documentos_tercero_id_idx on public.documentos (tercero_id);

create unique index documentos_company_tipo_num_uidx
  on public.documentos (company_id, tipo, num)
  where num > 0;

create unique index documentos_one_ini_uidx
  on public.documentos (company_id)
  where tipo = 'INI';

create table public.lineas_asiento (
  id uuid primary key default gen_random_uuid(),
  documento_id uuid not null references public.documentos (id) on delete cascade,
  orden integer not null check (orden >= 0),
  cuenta text not null references public.cuentas (codigo),
  debito bigint not null default 0 check (debito >= 0),
  credito bigint not null default 0 check (credito >= 0),
  detalle text not null default '',
  tercero_id uuid references public.terceros (id) on delete restrict,
  aplica_a uuid references public.documentos (id) on delete restrict,
  bank jsonb,
  bank_ref text,
  constraint lineas_un_lado check (
    (debito > 0 and credito = 0) or (credito > 0 and debito = 0)
  ),
  unique (documento_id, orden)
);

comment on table public.lineas_asiento is
  'Reemplaza asiento[]. bank guarda {k, n} del movimiento bancario (chq, tin, tout, dep, datafono). aplica_a es la factura del cruce de cartera.';

create index lineas_asiento_documento_id_idx on public.lineas_asiento (documento_id);
create index lineas_asiento_cuenta_idx on public.lineas_asiento (cuenta);
create index lineas_asiento_aplica_a_idx on public.lineas_asiento (aplica_a);

create table public.documento_items (
  id uuid primary key default gen_random_uuid(),
  documento_id uuid not null references public.documentos (id) on delete cascade,
  orden integer not null check (orden >= 0),
  tipo text not null check (tipo in ('prod', 'gasto')),
  producto_id uuid references public.productos (id) on delete restrict,
  cuenta text references public.cuentas (codigo),
  nombre text not null default '',
  cantidad numeric(18, 4) not null check (cantidad > 0),
  valor_unitario bigint not null check (valor_unitario > 0),
  iva smallint not null default 0 check (iva in (0, 5, 19)),
  unique (documento_id, orden),
  constraint items_prod_o_gasto check (
    (tipo = 'prod' and producto_id is not null)
    or (tipo = 'gasto' and cuenta is not null)
  )
);

comment on table public.documento_items is
  'Renglones de venta (tipo prod) y de compra (prod o gasto). El nombre queda copiado para el documento.';

create index documento_items_documento_id_idx on public.documento_items (documento_id);

create or replace function private.company_of(documento uuid)
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select company_id from public.documentos where id = documento;
$$;

create or replace function private.guard_documento()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  inicio date;
  party_company uuid;
begin
  select accounting_start into inicio
  from public.companies
  where id = new.company_id;

  if inicio is null then
    raise exception 'La empresa no existe';
  end if;

  if new.fecha < inicio then
    raise exception 'La fecha no puede ser anterior al inicio de la empresa';
  end if;

  if new.tercero_id is not null then
    select company_id into party_company
    from public.terceros
    where id = new.tercero_id;

    if party_company is distinct from new.company_id then
      raise exception 'El tercero no pertenece a la empresa';
    end if;
  end if;

  return new;
end;
$$;

create trigger documentos_guard
  before insert or update on public.documentos
  for each row
  execute function private.guard_documento();

create or replace function private.guard_linea()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  doc_company uuid;
  other_company uuid;
begin
  doc_company := private.company_of(new.documento_id);

  if doc_company is null then
    raise exception 'El documento no existe';
  end if;

  if new.tercero_id is not null then
    select company_id into other_company
    from public.terceros
    where id = new.tercero_id;

    if other_company is distinct from doc_company then
      raise exception 'El tercero no pertenece a la empresa';
    end if;
  end if;

  if new.aplica_a is not null then
    select company_id into other_company
    from public.documentos
    where id = new.aplica_a;

    if other_company is distinct from doc_company then
      raise exception 'El documento aplicado no pertenece a la empresa';
    end if;
  end if;

  return new;
end;
$$;

create trigger lineas_guard
  before insert or update on public.lineas_asiento
  for each row
  execute function private.guard_linea();

create or replace function private.guard_item()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  doc_company uuid;
  product_company uuid;
begin
  doc_company := private.company_of(new.documento_id);

  if doc_company is null then
    raise exception 'El documento no existe';
  end if;

  if new.producto_id is not null then
    select company_id into product_company
    from public.productos
    where id = new.producto_id;

    if product_company is distinct from doc_company then
      raise exception 'El producto no pertenece a la empresa';
    end if;
  end if;

  return new;
end;
$$;

create trigger items_guard
  before insert or update on public.documento_items
  for each row
  execute function private.guard_item();

-- Clears references first so a reset can delete a company whose receipts
-- point at its own invoices.
create or replace function private.delete_company_children()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.lineas_asiento
  set aplica_a = null
  where aplica_a in (
    select id from public.documentos where company_id = old.id
  );

  delete from public.lineas_asiento
  where documento_id in (
    select id from public.documentos where company_id = old.id
  );

  delete from public.documento_items
  where documento_id in (
    select id from public.documentos where company_id = old.id
  );

  delete from public.documentos where company_id = old.id;
  delete from public.terceros where company_id = old.id;
  delete from public.productos where company_id = old.id;

  return old;
end;
$$;

create trigger companies_delete_children
  before delete on public.companies
  for each row
  execute function private.delete_company_children();

-- ---------------------------------------------------------------------------
-- Delivery packages imported by the teacher
-- ---------------------------------------------------------------------------

create table public.paquetes (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid references public.classrooms (id) on delete set null,
  imported_by uuid references public.profiles (id) on delete set null,
  estudiante jsonb not null default '{}'::jsonb,
  emp jsonb not null default '{}'::jsonb,
  resumen jsonb not null default '{}'::jsonb,
  data text not null,
  imported_at timestamptz not null default now()
);

comment on table public.paquetes is
  'Paquete de entrega LAB1… que el docente pega para revisar. Solo el docente.';

create index paquetes_classroom_id_idx on public.paquetes (classroom_id);

-- ---------------------------------------------------------------------------
-- Signup directory
-- ---------------------------------------------------------------------------

create view public.classroom_directory
with (security_invoker = true) as
select id, name, semester, arqueo_dif, mensaje
from public.classrooms
where active;

comment on view public.classroom_directory is
  'Aulas activas para el formulario de registro: id, nombre, semestre y los dos ajustes que el taller ya muestra.';

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

revoke all on table public.classrooms from public, anon, authenticated;
revoke all on table public.profiles from public, anon, authenticated;
revoke all on table public.companies from public, anon, authenticated;
revoke all on table public.terceros from public, anon, authenticated;
revoke all on table public.productos from public, anon, authenticated;
revoke all on table public.cuentas from public, anon, authenticated;
revoke all on table public.documentos from public, anon, authenticated;
revoke all on table public.lineas_asiento from public, anon, authenticated;
revoke all on table public.documento_items from public, anon, authenticated;
revoke all on table public.paquetes from public, anon, authenticated;
revoke all on table public.classroom_directory from public, anon, authenticated;

grant select (id, name, semester, active, arqueo_dif, mensaje)
  on table public.classrooms to anon;
grant select, insert, update, delete on table public.classrooms to authenticated;

grant select, update on table public.profiles to authenticated;

grant select, insert, update, delete on table public.companies to authenticated;
grant select, insert, update, delete on table public.terceros to authenticated;
grant select, insert, update, delete on table public.productos to authenticated;
grant select on table public.cuentas to authenticated;
grant select, insert, update, delete on table public.documentos to authenticated;
grant select, insert, update, delete on table public.lineas_asiento to authenticated;
grant select, insert, update, delete on table public.documento_items to authenticated;
grant select, insert, update, delete on table public.paquetes to authenticated;

grant select on table public.classroom_directory to anon, authenticated;

grant select, insert, update, delete on table public.classrooms to service_role;
grant select, insert, update, delete on table public.profiles to service_role;
grant select, insert, update, delete on table public.companies to service_role;
grant select, insert, update, delete on table public.terceros to service_role;
grant select, insert, update, delete on table public.productos to service_role;
grant select, insert, update, delete on table public.cuentas to service_role;
grant select, insert, update, delete on table public.documentos to service_role;
grant select, insert, update, delete on table public.lineas_asiento to service_role;
grant select, insert, update, delete on table public.documento_items to service_role;
grant select, insert, update, delete on table public.paquetes to service_role;
grant select on table public.classroom_directory to service_role;

revoke all on function private.handle_new_user() from public;
revoke all on function private.protect_profile() from public;
revoke all on function private.protect_company() from public;
revoke all on function private.sync_company_classroom() from public;
revoke all on function private.company_of(uuid) from public;
revoke all on function private.guard_documento() from public;
revoke all on function private.guard_linea() from public;
revoke all on function private.guard_item() from public;
revoke all on function private.delete_company_children() from public;

grant execute on function private.handle_new_user() to supabase_auth_admin;
grant execute on function private.protect_profile() to authenticated;
grant execute on function private.protect_company() to authenticated;
grant execute on function private.sync_company_classroom() to authenticated;
grant execute on function private.company_of(uuid) to authenticated;
grant execute on function private.guard_documento() to authenticated;
grant execute on function private.guard_linea() to authenticated;
grant execute on function private.guard_item() to authenticated;
grant execute on function private.delete_company_children() to authenticated;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.classrooms enable row level security;
alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.terceros enable row level security;
alter table public.productos enable row level security;
alter table public.cuentas enable row level security;
alter table public.documentos enable row level security;
alter table public.lineas_asiento enable row level security;
alter table public.documento_items enable row level security;
alter table public.paquetes enable row level security;

create policy classrooms_select_anon
  on public.classrooms
  for select
  to anon
  using (active);

create policy classrooms_select_auth
  on public.classrooms
  for select
  to authenticated
  using (
    active
    or (select private.is_admin())
    or id in (
      select classroom_id
      from public.profiles
      where id = (select auth.uid())
    )
  );

create policy classrooms_insert_admin
  on public.classrooms
  for insert
  to authenticated
  with check ((select private.is_admin()));

create policy classrooms_update_admin
  on public.classrooms
  for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy classrooms_delete_admin
  on public.classrooms
  for delete
  to authenticated
  using ((select private.is_admin()));

create policy profiles_select
  on public.profiles
  for select
  to authenticated
  using (
    id = (select auth.uid())
    or (select private.is_admin())
  );

create policy profiles_update
  on public.profiles
  for update
  to authenticated
  using (
    id = (select auth.uid())
    or (select private.is_admin())
  )
  with check (
    id = (select auth.uid())
    or (select private.is_admin())
  );

create policy companies_select
  on public.companies
  for select
  to authenticated
  using (
    owner_id = (select auth.uid())
    or (select private.is_admin())
  );

create policy companies_insert
  on public.companies
  for insert
  to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1
      from public.profiles
      where id = (select auth.uid())
        and role = 'student'
        and classroom_id is not null
        and classroom_id = companies.classroom_id
    )
  );

create policy companies_update
  on public.companies
  for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy companies_delete_admin
  on public.companies
  for delete
  to authenticated
  using ((select private.is_admin()));

create policy terceros_select
  on public.terceros
  for select
  to authenticated
  using (
    (select private.is_admin())
    or exists (
      select 1
      from public.companies
      where id = company_id
        and owner_id = (select auth.uid())
    )
  );

create policy terceros_insert
  on public.terceros
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.companies
      where id = company_id
        and owner_id = (select auth.uid())
    )
  );

create policy terceros_update
  on public.terceros
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.companies
      where id = company_id
        and owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.companies
      where id = company_id
        and owner_id = (select auth.uid())
    )
  );

create policy terceros_delete
  on public.terceros
  for delete
  to authenticated
  using (
    (select private.is_admin())
    or exists (
      select 1
      from public.companies
      where id = company_id
        and owner_id = (select auth.uid())
    )
  );

create policy productos_select
  on public.productos
  for select
  to authenticated
  using (
    (select private.is_admin())
    or exists (
      select 1
      from public.companies
      where id = company_id
        and owner_id = (select auth.uid())
    )
  );

create policy productos_insert
  on public.productos
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.companies
      where id = company_id
        and owner_id = (select auth.uid())
    )
  );

create policy productos_update
  on public.productos
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.companies
      where id = company_id
        and owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.companies
      where id = company_id
        and owner_id = (select auth.uid())
    )
  );

create policy productos_delete
  on public.productos
  for delete
  to authenticated
  using (
    (select private.is_admin())
    or exists (
      select 1
      from public.companies
      where id = company_id
        and owner_id = (select auth.uid())
    )
  );

create policy cuentas_select
  on public.cuentas
  for select
  to authenticated
  using (true);

create policy documentos_select
  on public.documentos
  for select
  to authenticated
  using (
    (select private.is_admin())
    or exists (
      select 1
      from public.companies
      where id = company_id
        and owner_id = (select auth.uid())
    )
  );

create policy documentos_insert
  on public.documentos
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.companies
      where id = company_id
        and owner_id = (select auth.uid())
    )
  );

create policy documentos_update
  on public.documentos
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.companies
      where id = company_id
        and owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.companies
      where id = company_id
        and owner_id = (select auth.uid())
    )
  );

create policy documentos_delete
  on public.documentos
  for delete
  to authenticated
  using (
    (select private.is_admin())
    or exists (
      select 1
      from public.companies
      where id = company_id
        and owner_id = (select auth.uid())
    )
  );

create policy lineas_select
  on public.lineas_asiento
  for select
  to authenticated
  using (
    (select private.is_admin())
    or exists (
      select 1
      from public.documentos d
      join public.companies c on c.id = d.company_id
      where d.id = documento_id
        and c.owner_id = (select auth.uid())
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
      join public.companies c on c.id = d.company_id
      where d.id = documento_id
        and c.owner_id = (select auth.uid())
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
      join public.companies c on c.id = d.company_id
      where d.id = documento_id
        and c.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.documentos d
      join public.companies c on c.id = d.company_id
      where d.id = documento_id
        and c.owner_id = (select auth.uid())
    )
  );

create policy lineas_delete
  on public.lineas_asiento
  for delete
  to authenticated
  using (
    (select private.is_admin())
    or exists (
      select 1
      from public.documentos d
      join public.companies c on c.id = d.company_id
      where d.id = documento_id
        and c.owner_id = (select auth.uid())
    )
  );

create policy items_select
  on public.documento_items
  for select
  to authenticated
  using (
    (select private.is_admin())
    or exists (
      select 1
      from public.documentos d
      join public.companies c on c.id = d.company_id
      where d.id = documento_id
        and c.owner_id = (select auth.uid())
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
      join public.companies c on c.id = d.company_id
      where d.id = documento_id
        and c.owner_id = (select auth.uid())
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
      join public.companies c on c.id = d.company_id
      where d.id = documento_id
        and c.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.documentos d
      join public.companies c on c.id = d.company_id
      where d.id = documento_id
        and c.owner_id = (select auth.uid())
    )
  );

create policy items_delete
  on public.documento_items
  for delete
  to authenticated
  using (
    (select private.is_admin())
    or exists (
      select 1
      from public.documentos d
      join public.companies c on c.id = d.company_id
      where d.id = documento_id
        and c.owner_id = (select auth.uid())
    )
  );

create policy paquetes_admin
  on public.paquetes
  for all
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- ---------------------------------------------------------------------------
-- Repository files. Path: {company_id}/{document_id}/filename
-- Deleting a company does not remove these objects.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit)
values ('soportes', 'soportes', false, 20971520);

create policy soportes_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'soportes'
    and (
      (select private.is_admin())
      or (select private.owns_object_company(name))
    )
  );

create policy soportes_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'soportes'
    and coalesce(array_length(storage.foldername(name), 1), 0) >= 2
    and (select private.owns_object_company(name))
  );

create policy soportes_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'soportes'
    and (select private.owns_object_company(name))
  )
  with check (
    bucket_id = 'soportes'
    and coalesce(array_length(storage.foldername(name), 1), 0) >= 2
    and (select private.owns_object_company(name))
  );

create policy soportes_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'soportes'
    and (select private.owns_object_company(name))
  );
