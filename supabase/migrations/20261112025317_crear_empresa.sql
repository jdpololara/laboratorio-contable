-- One transaction for the practice company, its catalogs, and the opening entry.
-- Runs as the signed-in student, so the existing policies still apply.

create or replace function public.crear_empresa(payload jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  room uuid;
  rol text;
  new_id uuid;
  doc_id uuid;
  item jsonb;
  caja bigint;
  banco bigint;
  inv bigint;
  total bigint;
  orden integer := 0;
  inicio date;
  terceros jsonb := coalesce(payload -> 'terceros', '[]'::jsonb);
  productos jsonb := coalesce(payload -> 'productos', '[]'::jsonb);
begin
  if uid is null then
    raise exception 'Inicia sesión para crear la empresa';
  end if;

  if jsonb_typeof(terceros) is distinct from 'array'
     or jsonb_typeof(productos) is distinct from 'array'
     or jsonb_array_length(terceros) > 30
     or jsonb_array_length(productos) > 40 then
    raise exception 'El catálogo de la empresa no es válido';
  end if;

  select p.classroom_id, p.role
  into room, rol
  from public.profiles p
  where p.id = uid;

  if rol is distinct from 'student' then
    raise exception 'El docente no crea la empresa de práctica';
  end if;

  if room is null then
    raise exception 'Elige un aula antes de crear la empresa';
  end if;

  if exists (select 1 from public.companies c where c.owner_id = uid) then
    raise exception 'Ya tienes una empresa';
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

  insert into public.companies (
    owner_id, classroom_id, razon, nit, ciudad, direccion,
    work_date, accounting_start,
    resol_numero, resol_fecha, resol_prefijo, resol_desde, resol_hasta,
    banco_nombre, banco_cuenta, banco_cheque_ini, banco_saldo0, resumen
  ) values (
    uid,
    room,
    btrim(payload ->> 'razon'),
    btrim(payload ->> 'nit'),
    coalesce(btrim(payload ->> 'ciudad'), ''),
    coalesce(btrim(payload ->> 'direccion'), ''),
    coalesce((payload ->> 'work_date')::date, inicio),
    inicio,
    btrim(payload ->> 'resol_numero'),
    (payload ->> 'resol_fecha')::date,
    coalesce(nullif(btrim(payload ->> 'resol_prefijo'), ''), 'FE'),
    coalesce((payload ->> 'resol_desde')::integer, 1),
    coalesce((payload ->> 'resol_hasta')::integer, 5000),
    coalesce(nullif(btrim(payload ->> 'banco_nombre'), ''), 'Banco del Altiplano'),
    btrim(payload ->> 'banco_cuenta'),
    (payload ->> 'banco_cheque_ini')::integer,
    banco,
    jsonb_build_object(
      'docs', 1,
      'ventas', 0,
      'arqueos', jsonb_build_array(0, 0),
      'concil', '[]'::jsonb,
      'ultima', to_jsonb(now())
    )
  )
  returning id into new_id;

  for item in select value from jsonb_array_elements(terceros)
  loop
    insert into public.terceros (company_id, tipo_doc, doc, nombre, rol, correo)
    values (
      new_id,
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
      new_id,
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
  where company_id = new_id;

  total := caja + banco + inv;
  if total <= 0 then
    raise exception 'Escribe al menos un saldo inicial';
  end if;

  insert into public.documentos (company_id, tipo, num, fecha, extra)
  values (new_id, 'INI', 0, inicio, '{}'::jsonb)
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

  return new_id;
end;
$$;

revoke all on function public.crear_empresa(jsonb) from public, anon;
grant execute on function public.crear_empresa(jsonb) to authenticated;

comment on function public.crear_empresa(jsonb) is
  'Crea la empresa del estudiante, el catálogo y el asiento de apertura en una sola transacción.';
