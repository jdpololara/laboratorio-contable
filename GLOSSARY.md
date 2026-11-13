# Glosario

Términos del laboratorio. Usar estas palabras en pantallas, issues y código de dominio. La fuente de las decisiones es el cuestionario respondido por el docente (resaltados en `~/Downloads/preguntas-para-el-docente-respuestas.docx`) y [ADR-0001](docs/adr/0001-empresas-personales-y-de-equipo.md).

## Aula

Grupo del curso que crea el docente. Tiene nombre, semestre, mensaje y la opción de que el arqueo traiga diferencia. Una persona puede pertenecer a varias aulas.

No decir: clase, salón, grupo (como entidad).

## Docente

La cuenta administradora del laboratorio. Crea aulas y empresas, mete alumnos en empresas, define qué puede hacer cada membresía, ve todo y puede corregir asientos. No es un cargo dentro de la empresa.

No decir: administrador, cuando se hable de esta cuenta. «Administrador» en la lista de cargos es un nombre más, no esta cuenta.

## Alumno

Persona que se registra con correo y contraseña. Elige un aula al registrarse. El docente puede sumarla a otras aulas y meterla en empresas. El alumno elige su cargo de un listado.

No decir: usuario, cuando se distinga del docente. En base de datos sigue siendo un perfil con `role = student`.

## Empresa personal

La empresa de un alumno dentro de un aula, la que cuenta para la nota y para la ruta del taller. Hay una por alumno y por aula. El docente la crea vacía. El alumno completa razón social, NIT, saldos y catálogo.

No decir: empresa del estudiante como si fuera la única forma de empresa.

## Empresa de equipo

Empresa dentro de un aula, creada vacía por el docente, con varios alumnos. Cada uno trabaja con su cargo sobre los mismos libros. Es un ejercicio aparte: no reemplaza la empresa personal ni la ruta.

No decir: empresa compartida, como nombre de dominio. En una explicación sí se puede decir que los libros son del equipo.

## Cargo

Puesto de la persona dentro de una empresa: auxiliar contable, contador, auditor, u otro nombre que el docente agrega al listado del aula. El alumno lo elige. El documento queda firmado con el cargo de quien lo hizo. Algunos cargos solo nombran; otros restringen acciones. El auditor solo consulta los libros de su empresa.

No decir: rol, para este puesto. Rol ya es el del tercero.

## Rol de tercero

Si un tercero es cliente, proveedor o ambos. Vive en `terceros.rol`. No es el cargo de un alumno.

## Membresía

El lugar de un alumno en una empresa: la persona, la empresa, el cargo que eligió y las acciones que el docente le dejó (hacer, ver o no ver). Una persona puede tener varias membresías, en varias empresas y con varios cargos.

## Historial

Registro de lo que hizo cada alumno: quién, con qué cargo, en qué empresa, sobre qué documento y cuándo. Un documento sigue a nombre de quien lo creó aunque otra persona lo corrija. La corrección entra al historial, no borra al autor.

## Nota de contabilidad

Asiento que se escribe a mano: ajustes, causaciones y correcciones. Tipo `NC`. No es una nota crédito ni una nota débito.

## Nota crédito y nota débito

Documentos propios, ligados a una factura. Todavía no existen en el laboratorio. La cuenta 4175 es la de devoluciones en ventas.
