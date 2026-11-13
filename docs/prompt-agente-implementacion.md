Implementa las fases 1 y 2 del laboratorio contable en este repositorio (`/Users/edujlac/Documents/lab-contable`). No implementes las fases 3, 4 ni 5.

Antes de escribir código, lee en este orden:

1. `GLOSSARY.md`
2. `docs/adr/0001-empresas-personales-y-de-equipo.md`
3. `docs/plan-aulas-empresas-y-cargos.md`
4. `AGENTS.md` y, antes de tocar Next.js, la guía que corresponda en `node_modules/next/dist/docs/`
5. El esquema actual: `supabase/migrations/20261111190000_initial_schema.sql`, `supabase/migrations/20261112025317_crear_empresa.sql`, `lib/session.ts`, `app/page.tsx`, `app/panel/page.tsx`, `app/panel/actions.ts`, `lib/lab/progress.ts`, `lib/lab/nav.ts`

El plan es la especificación. El glosario fija las palabras de la interfaz. El ADR es la decisión y no se reabre. Si algo del código contradice el plan, sigue el plan y deja las empresas ya guardadas funcionando.

Haz solo esto:

- Fase 1: la migración nueva de membresías, cargos, empresas personales y de equipo, acciones y historial. No edites las dos migraciones que ya existen.
- Fase 2: las pantallas del docente y del alumno descritas en el plan, incluida la ruta contando solo la empresa personal.

Para al terminar la fase 2. No construyas nota crédito, nota débito, el desplegable de venta, PEPS, UEPS, el PUC completo ni el sistema de costos.

Reglas de trabajo:

- En pantalla se dice cargo. Rol se reserva al tercero (cliente, proveedor o ambos).
- No abras issues ni hagas commits.
- No cambies IVA, retención, el asiento de apertura contra la 3105, la caja única ni el banco único. Borrar una empresa no borra los archivos del bucket `soportes`.
- El alumno se registra solo y elige el cargo. El docente crea la empresa vacía, mete al alumno y define hacer, ver o no ver en esa membresía.
- Cuando termines, recorre en el navegador el flujo del docente y el del alumno: crear el aula, crear la empresa personal y una de equipo, completar la personal, elegir cargo, esconder una sección, corregir un asiento como docente y ver el historial. Si no hay navegador, deja dicho qué no pudiste verificar.
