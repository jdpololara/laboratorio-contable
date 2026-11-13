# Plan: aulas, empresas y cargos

Para el agente que implemente. Leer antes `GLOSSARY.md` y `docs/adr/0001-empresas-personales-y-de-equipo.md`. Usar esas palabras. No reabrir lo que este plan ya cerró. No abrir issues ni commits salvo que lo pidan.

La fuente es el cuestionario con resaltado amarillo o verde en `~/Downloads/preguntas-para-el-docente-respuestas.docx`. El comentario de la pregunta 11 no está resaltado y sí cuenta: «también puede ser que exista un registro de las actividades como historial de cada alumno».

## Qué quedó cerrado

1. Dentro de un aula hay varias **empresas de equipo**, creadas por el docente. Cada una tiene sus libros y varias personas, cada una con un cargo.
2. El docente crea la empresa vacía. El alumno completa razón social, NIT, saldos, clientes, proveedores y productos.
3. Hay personas reales con su cuenta, y cada documento queda firmado con el cargo de quien lo hizo.
4. El alumno se registra solo. El docente lo mete en la empresa. El alumno elige el cargo. El resaltado de la pregunta 4 corta antes de «y le pone el cargo», y el comentario dice «el estudiante puede escoger el cargo».
5. La misma persona puede tener varios cargos en la misma empresa, estar en varias empresas del aula y en varias aulas.
6. Un cargo puede ser solo un nombre, o restringir acciones. Cuáles restringen no vino en una lista fija.
7. No hay una matriz global de permisos. Al entrar a la membresía, el docente define qué hace ese perfil.
8. El listado de cargos empieza con auxiliar contable, contador, administrador y auditor, y el docente puede seguir agregando nombres.
9. El administrador del laboratorio es el docente. Un cargo que se llame administrador es solo un nombre del listado.
10. El auditor solo consulta los libros de su empresa. No registra.
11. Cada alumno conserva su **empresa personal** para la nota y la ruta. La empresa de equipo es un ejercicio aparte. Además existe el **historial** de actividades de cada alumno.
12. Puede corregir un documento quien tenga la acción, incluido el contador sobre lo del auxiliar, cualquier miembro de la empresa con permiso, y el docente.
13. El documento queda a nombre de quien lo creó.
14. En pantalla se dice cargo, no rol.
15. Hace falta una nota crédito y una nota débito como documentos propios, ligados a la factura. La nota de contabilidad (`NC`) sigue siendo el asiento manual.

Reglas del taller que pidió cambiar, en una fase posterior:

- La empresa también puede fabricar, para tener sistema de costos.
- El plan de cuentas pasa a ser el PUC completo, y se pueden crear cuentas nuevas.
- El inventario admite promedio, PEPS y UEPS. «Todos los medios» en este taller son esos tres.
- En una venta, un desplegable elige punto de venta o factura electrónica. La forma de pago sigue siendo otra elección.

Reglas que se quedan: IVA 0 %, 5 % o 19 % en la 2408; retención en venta al 2,5 % en la 1355 cuando el cliente es agente retenedor; en compras el porcentaje lo elige quien registra y va a la 2365; apertura contra la 3105; una caja (1105) y un banco (1110); borrar la empresa no borra los archivos del repositorio.

## Supuestos para no volver a preguntar

- Una empresa personal por alumno y por aula. Las demás empresas de ese alumno en esa aula son de equipo.
- El historial se suma a la empresa personal. No la reemplaza.
- Las acciones de una membresía son hacer, ver o no ver, por cada fila de la lista de abajo. Se guardan en la membresía, no en el cargo. El cargo auditor, al asignarse, nace en solo ver. Un cargo marcado «solo nombre» nace pudiendo hacer las acciones de trabajo y sin poder borrar la empresa. El docente puede cambiar esas casillas al abrir la membresía.
- Si una persona tiene varios cargos en la misma empresa, puede hacer una acción cuando alguno de esos cargos se la deja.
- El docente puede hacer y ver todo, en todas las empresas, incluidos corregir asientos y borrar la empresa.
- El alumno completa los datos de una empresa vacía si tiene la acción de editar la empresa. En la personal, la completa él. En la de equipo, cualquier miembro con esa acción, una sola vez.
- El sistema de costos de la fase 5 es por órdenes de producción: materiales, mano de obra y CIF entran a una orden, y la orden terminada entra al inventario de productos terminados. El docente no eligió entre órdenes y procesos.

## Lo que el código hace hoy y este plan cambia

- `profiles.classroom_id` es un solo aula. `profiles.role` es `admin` o `student`. El alta en `private.handle_new_user` siempre crea `student`.
- `companies.owner_id` es único. `public.crear_empresa` exige alumno, aula y cero empresas previas, y escribe el asiento de apertura.
- Las políticas de `terceros`, `productos`, `documentos`, `lineas_asiento`, `documento_items` y el bucket `soportes` autorizan al `owner_id` o al docente. El docente no pasa el `with check` de actualización de líneas: hoy no puede corregir un asiento.
- `lib/session.ts` expone un solo `classroomId`. `app/page.tsx` busca una empresa por `owner_id`. `lib/lab/progress.ts` arma la ruta con los documentos de esa empresa.
- La valoración a costo promedio, el POS y la factura electrónica viven en `index.html`. Las pantallas de `app/s/` todavía no registran documentos. Las fases 4 y 5 no se adelantan a reescribir ese motor.

## Acciones de una membresía

Cada una admite hacer, ver o no ver.

| Clave | Pantalla |
| --- | --- |
| `company.edit` | Datos de la empresa, facturación, banco y completar la empresa vacía |
| `terceros.write` | Terceros |
| `productos.write` | Productos e inventario |
| `pos.write` | Punto de venta |
| `fe.write` | Facturas de venta |
| `rc.write` | Recibos de caja |
| `fc.write` | Facturas de compra |
| `ce.write` | Comprobantes de egreso |
| `caja.write` | Arqueo y consignación |
| `banco.write` | Extracto y conciliación |
| `nc.write` | Notas de contabilidad |
| `books.read` | Libros y estados financieros |
| `files.write` | Soportes y correos |
| `document.void` | Anular un documento |
| `company.delete` | Borrar la empresa y empezar de cero |

Ver un documento no exige la acción de escribirlo. No ver lo esconde de la navegación de esa empresa.

## Fase 1. Membresías

Migración nueva en `supabase/migrations/`. No reescribir las dos migraciones ya aplicadas.

Tablas y columnas:

- `classroom_members (user_id, classroom_id)` única por par. Se llena con el `classroom_id` actual de cada perfil. Un alumno nuevo, al registrarse, sigue eligiendo un aula y esa elección inserta la primera fila.
- `cargos (id, classroom_id, name, label_only)`. Única por aula y nombre. Al crear un aula se siembran auxiliar contable, contador, administrador y auditor. Auditor no es `label_only`. El docente inserta nombres nuevos en el aula.
- `companies.kind` en `personal` o `equipo`. `companies.student_id` solo en las personales, único por `(student_id, classroom_id)`. Las filas actuales quedan `personal` con `student_id = owner_id`. `owner_id` se conserva como el alumno de la personal, para no romper la lectura actual hasta que las políticas cambien; deja de ser la llave de permiso.
- `company_members (id, company_id, user_id, cargo_id)` y `company_member_actions (member_id, action, level)` con `level` en `do`, `view`, `hide`. Única por miembro y acción.
- `documentos.created_by` y `documentos.cargo_id`, inmutables. Un trigger rechaza cambiarlos. Lo mismo en las líneas no hace falta: el autor es el del documento.
- `activity_events (id, actor_id, cargo_id, classroom_id, company_id, document_id, action, at)`. Solo inserción. La borran en cascada la empresa o el documento, no un usuario.

Funciones:

- `crear_empresa_vacia(classroom_id, kind, student_id)` la ejecuta el docente. En `personal`, `student_id` es obligatorio y no puede repetirse en el aula. No escribe saldos ni asiento.
- `completar_empresa` sustituye el cuerpo actual de `crear_empresa` para una empresa vacía cuya membresía tenga `company.edit` en `do`. Sigue creando terceros, productos y el asiento de apertura en una transacción.
- Al meter un alumno en una empresa, el docente elige el cargo. Si el cargo es auditor, las acciones nacen en `view` para libros y documentos y en `hide` para escribir y borrar. Si el cargo es `label_only`, nacen en `do` salvo `company.delete`, que nace en `hide`.

Políticas:

- Un alumno lee y escribe una fila de empresa si alguna de sus membresías en esa empresa tiene la acción en `do`. `view` permite select y no insert ni update. El docente pasa todas.
- El docente puede actualizar `lineas_asiento`, `documentos` y el resto. Cada update de un documento o una línea inserta un `activity_events` con el actor, sin tocar `created_by`.
- Anular exige `document.void`. Borrar la empresa exige `company.delete` o ser docente. Sigue sin borrar objetos del bucket `soportes`.
- `private.is_admin()` se queda para el docente.

Aceptación:

- Un docente crea dos empresas de equipo en un aula y una personal para un alumno.
- El alumno completa solo la personal, y un compañero con `company.edit` completa la de equipo.
- El mismo alumno está en las dos, con cargos distintos, y en dos aulas.
- Un documento de la de equipo muestra al autor y su cargo después de que el docente corrija una línea.
- El historial del alumno lista la creación y la corrección.
- El auditor de esa empresa lee los libros y no inserta un documento.
- La ruta de `lib/lab/progress.ts` cuenta solo la empresa personal.
- Las empresas ya guardadas siguen abriendo para su alumno.

## Fase 2. Pantallas

Docente, en `app/panel/` y `components/panel-forms.tsx`:

- Crear empresa vacía, personal o de equipo, dentro de un aula.
- Meter y sacar alumnos. El alumno ya registrado elige el cargo; el docente, en esa membresía, marca hacer, ver o no ver.
- Listado de cargos del aula, con alta de nombres y la marca de solo nombre.
- Historial por alumno, cruzando sus empresas.
- La ruta y el avance siguen apuntando a la empresa personal.

Alumno, en `app/page.tsx`, `components/setup-form.tsx` y `lib/session.ts`:

- Si tiene varias aulas, elige con cuál trabaja.
- Si tiene varias empresas en esa aula, elige con cuál trabaja. La personal es la de inicio.
- Si la empresa elegida está vacía y puede editarla, ve el formulario actual de alta.
- La navegación de `lib/lab/nav.ts` esconde las secciones en `hide` y deja en solo lectura las que están en `view`.
- `lib/session.ts` deja de exponer un solo `classroomId` como si fuera el único aula. Pasa la lista de aulas y la empresa activa.

Aceptación: con dos alumnos, un docente arma un equipo, cada uno elige cargo, uno vende y el otro solo ve, y el panel del docente muestra el historial de los dos. La ruta del que tiene empresa personal no sube por un documento del equipo.

## Fase 3. Nota crédito, nota débito y el desplegable de la venta

Hacerla cuando exista el registro de facturas en la aplicación, no dentro de `index.html`.

- Dos tipos nuevos, ligados a una factura de venta por `aplica_a` o una columna `factura_id` de la misma empresa. No reutilizar `NC`.
- La nota crédito disminuye la venta por la 4175 y revierte el costo y el IVA de esa factura en la proporción del valor. La nota débito aumenta la venta por la 4135.
- En la venta, un desplegable elige POS o factura electrónica. La forma de pago se elige aparte. El POS ya no queda obligado a ser de contado, ni la factura electrónica a 30 días: eso pasa a ser la forma de pago.

Aceptación: una factura de venta tiene una nota crédito parcial y el libro de esa empresa muestra la 4175 y el saldo de clientes disminuido. El mismo flujo, cambiando el desplegable, guarda un POS.

## Fase 4. Inventario y plan de cuentas

- Al completar la empresa se elige promedio, PEPS o UEPS. El promedio es el de hoy: costo móvil en la salida. PEPS y UEPS consumen capas de compra. El saldado sigue calculándose, no se guarda un libro de inventario.
- El plan de cuentas de referencia pasa a ser el PUC del Decreto 2650, como catálogo de laboratorio de solo lectura. Cada empresa copia las cuentas que usa y puede crear una cuenta nueva (código, nombre, clase) si la membresía tiene `company.edit`. Las líneas referencian la cuenta de la empresa, no solo la fila global de `public.cuentas`.
- Hasta que la fase 3 exista en React, no mover la valoración que está en `index.html` a medias. El cambio de método entra con el registro de compras y ventas.

Aceptación: dos empresas del mismo aula, una a PEPS y otra a promedio, con la misma compra y la misma venta, dejan costos distintos. Un alumno con permiso crea la cuenta 1405 y la usa en una nota de contabilidad.

## Fase 5. Empresa que fabrica

Una empresa, al completarse, es comercializadora o fabricante. La comercializadora sigue como ahora.

La fabricante lleva órdenes de producción. Cada orden junta materiales, mano de obra y CIF. Al cerrarla, el costo entra al inventario de productos terminados y de ahí al costo de venta. Las cuentas salen del PUC de la fase 4 (inventario de materias primas, órdenes en proceso, inventario de producto terminado, costos de producción). No hace falta costos por procesos.

Aceptación: una orden consume materia prima y mano de obra, se cierra, y el saldo de producto terminado sube por ese costo. Una venta posterior baja ese inventario y registra el costo de venta.

## Orden y límites

Implementar la fase 1 y dejarla usable antes de la 2. La 2 antes de la 3. La 4 antes de la 5. No mezclar el sistema de costos con el cambio de permisos.

No cambiar IVA, retención, apertura, la caja única ni el banco único. No hacer que el alumno cree la empresa de equipo por su cuenta. No hacer que el docente fabrique contraseñas. No borrar archivos del bucket al borrar la empresa.
