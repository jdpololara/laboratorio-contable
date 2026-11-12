# Laboratorio Contable

Práctica de contabilidad para el aula. La aplicación es Next.js 16.4.6 con App Router y guarda los datos en Supabase. `index.html` queda como referencia del taller mientras cada pantalla pasa a componentes de React.

El ingreso está en `/ingreso`. El estudiante crea la cuenta con correo, contraseña y un aula activa. El docente entra con la cuenta promovida a `admin` y abre `/panel`, donde crea las aulas y ve a los estudiantes. Con el aula elegida, el estudiante crea su empresa de práctica: esa acción usa `public.crear_empresa`.

## Arranque local

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Modelo de datos

Cada estudiante tiene una cuenta, un aula y, como máximo, una empresa de práctica. El docente (`role = admin`) crea las aulas y ve a todos los estudiantes. Un estudiante no crea aulas: al registrarse elige una activa. El rol no se lee de los metadatos del usuario; la base siempre crea el perfil como `student`.

El reemplazo del guardado en el navegador (`localStorage` `lab_empresa_v1` e IndexedDB `lab_files`) queda así:

- `profiles` — usuario de Auth, `role` (`admin` o `student`), nombre y aula. El aula solo se puede elegir mientras esté vacía; después la cambia el docente.
- `classrooms` — nombre, semestre, si está activa, y los ajustes del taller `arqueo_dif` y `mensaje` (antes un solo `config/lab`, ahora por aula).
- `classroom_directory` — aulas activas visibles sin sesión: `id`, `name`, `semester`, `arqueo_dif`, `mensaje`. Es la lista del futuro registro.
- `companies` — una por estudiante. Razón social, NIT, ciudad, dirección, fecha de trabajo, inicio de la contabilidad, resolución de facturación, banco y `resumen`. El nombre del estudiante ya no se copia aquí.
- `terceros` y `productos` — los catálogos que antes vivían dentro de la empresa.
- `cuentas` — el PUC que usa el laboratorio. Solo lectura.
- `documentos` — un comprobante: `INI`, `FE`, `POS`, `RC`, `FC`, `CE`, `CG`, `NC`, `AQ`, `EXT`, `CON`, `MAIL`, `ARC`. Lo que no es común va en `extra`.
- `lineas_asiento` — el asiento. `bank` guarda la marca bancaria `{k, n}` y `aplica_a` la factura del cruce de cartera.
- `documento_items` — renglones de venta (`prod`) y de compra (`prod` o `gasto`).
- `paquetes` — el paquete `LAB1…` que el docente importa. Solo él lo ve.
- Bucket `soportes` — archivos del repositorio, privados, máximo 20 MB. La ruta es `{company_id}/{document_id}/archivo`.

`resumen` lo sigue calculando la aplicación, con la forma que ya usa el panel: `docs`, `ventas`, `arqueos` como `[exactos, total]`, `concil` como `[{P, nota}]` y `ultima`. Los libros, el inventario y la cartera no se guardan: se arman desde las líneas, igual que hoy.

En `extra`, según el tipo:

- `FE`: `pref`, `vence`, `cufe`, `base`, `iva`, `total`, `ret`, `neto`, `costo`
- `POS`: `base`, `iva`, `total`, `ret`, `neto`, `costo`, `recibido`, `cambio`
- `FC`: `fact_prov`, `ret_pct`, `base`, `iva`, `total`, `ret`, `neto`, `cheque`
- `RC` y `CE`: `aplica_a`, `valor`, y `cheque` en el egreso
- `CG`: `valor`, `ref`
- `NC`: `concepto`, `origen`
- `AQ`: `libros`, `real_total`, `real`, `conteo`, `contado`, `dif`, `cuenta`, `responsable`, `obs`, `acierto`
- `EXT`: `periodo`, `saldo_ant`, `saldo_final`, `rows`, `incluye`
- `CON`: `periodo`, `ans`, `res`, `sol`, `nota_id`
- `MAIL`: `para`, `asunto`, `cuerpo`, `doc_id`
- `ARC`: `nombre`, `mime`, `size`, `carpeta`, `desc`, `link`, `storage_path`

El estudiante lee y escribe solo su empresa. El docente lee todas, reasigna aulas y puede borrar una empresa para reiniciarla. No puede modificar las líneas de un estudiante. Borrar la empresa no borra los archivos del bucket `soportes`.

## Aplicar la migración

Estas órdenes se corren en tu terminal, contra el proyecto de Supabase del laboratorio. `supabase link` guarda la referencia solo en `supabase/.temp` de este repositorio (no se sube a git). No uses el proyecto de Supabase que ya tengas conectado en este equipo.

Instala la [CLI de Supabase](https://supabase.com/docs/guides/local-development/cli/getting-started) e inicia sesión con `supabase login` si todavía no lo hiciste. En la raíz del repositorio:

```bash
supabase link --project-ref <REF_DEL_PROYECTO_DEL_LAB>
supabase db push
```

La referencia está en el panel de Supabase, en Project Settings → General → Reference ID. `db push` aplica las migraciones de [supabase/migrations](supabase/migrations), incluida `crear_empresa`.

Si `db push` avisa que la versión de Postgres no coincide, cambia `major_version` en [supabase/config.toml](supabase/config.toml) por la que devuelva `show server_version;` en ese proyecto y vuelve a correr `supabase db push`.

### Promover al docente

Crea el usuario en Authentication → Users (o, más adelante, con el registro de la aplicación). Luego, en el SQL Editor:

```sql
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'tu-correo');
```

Ese `update` hay que ejecutarlo en el SQL Editor. El registro de la aplicación no puede conceder el rol de docente.

### Crear un aula

Hasta que exista el panel, el SQL Editor también sirve para cargar las aulas que el estudiante va a elegir:

```sql
insert into public.classrooms (name, semester)
values ('Contabilidad IV', '2026-2');
```

`semester` es el texto que ve el estudiante (por ejemplo `2026-2`). `arqueo_dif` queda en verdadero y `mensaje` vacío, que es el comportamiento actual del taller.

## Variables de entorno

Copia [.env.example](.env.example) a `.env.local` y completa los valores del proyecto del laboratorio (Project Settings → API): la URL y la publishable key. No hace falta la clave secreta para esta entrega, y `.env.local` no se commitea. El cliente de Supabase se conecta en el siguiente paso, con el inicio de sesión.
