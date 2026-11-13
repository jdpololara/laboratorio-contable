# ADR-0001: Empresas personales y de equipo, con cargos

Estado: aceptada. La aceptó el docente al resaltar el cuestionario de noviembre de 2026, y el comentario sin resaltar de la pregunta 11 entra en esta decisión.

## Contexto

Hoy un alumno pertenece a un solo aula y es dueño único de una sola empresa. El docente ve los asientos y no los modifica. El docente pidió crear varias empresas dentro del aula y, en cada una, personas con cargos que pueden restringir acciones.

## Decisión

Hay dos empresas.

- La **empresa personal** es una por alumno y por aula. Sobre ella corre la ruta del taller y la nota.
- La **empresa de equipo** la crea el docente, vacía, y varios alumnos trabajan en sus libros. Es un ejercicio aparte de la nota.

El docente crea ambas vacías. El alumno completa los datos. El alumno se registra solo; el docente lo mete en la empresa; el alumno elige el **cargo** en un listado que el docente puede alargar. Al abrir esa membresía, el docente define qué acciones puede hacer, ver o no ver.

Cada documento queda firmado con la persona y el cargo de quien lo creó. Eso no cambia si otro lo corrige. El **historial** guarda cada acción del alumno. Cualquier miembro con permiso de escribir puede modificar documentos de su empresa. El contador puede anular o corregir lo del auxiliar cuando su cargo se lo permite. El docente puede corregir asientos.

El cargo auditor solo consulta los libros de su empresa. La cuenta docente es el administrador del laboratorio, no un cargo.

Una misma persona puede tener varios cargos, estar en varias empresas del mismo aula y en varias aulas.

## Consecuencias

`profiles.classroom_id` deja de ser el único aula. `companies.owner_id` deja de ser único y deja de ser la única llave de permiso. Las políticas que hoy exigen `owner_id = auth.uid()` pasan a mirar la membresía y las acciones. El docente gana permiso de escribir asientos, que hoy no tiene.

La ruta del taller solo cuenta documentos de la empresa personal.

## Fuera de esta decisión

El docente también pidió empresa fabricante con sistema de costos, el PUC completo con cuentas nuevas, más de un método de inventario, y nota crédito o nota débito ligada a la factura. Eso es trabajo posterior, descrito en el plan. No cambia esta decisión.
