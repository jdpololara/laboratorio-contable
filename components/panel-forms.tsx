"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  addMember,
  addToClassroom,
  createCargo,
  createClassroom,
  createEmptyCompany,
  removeFromClassroom,
  removeMember,
  resetCompany,
  saveCargo,
  saveClassroom,
  saveMemberActions,
  type PanelState,
} from "@/app/panel/actions";
import { ACTIONS, companyLabel, kindLabel } from "@/lib/lab/membership";

function ErrorText({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <p className="note bad" role="alert">
      {error}
    </p>
  );
}

export function CreateClassroomForm() {
  const [state, action, pending] = useActionState<PanelState, FormData>(
    createClassroom,
    null,
  );

  return (
    <form className="card stack" action={action}>
      <h3>Nueva aula</h3>
      <div className="fgrid">
        <label className="f">
          Nombre
          <input className="in" name="name" placeholder="Ej.: Contabilidad IV" required />
        </label>
        <label className="f">
          Semestre
          <input className="in" name="semester" placeholder="Ej.: 2026-2" required />
        </label>
      </div>
      <ErrorText error={state?.error} />
      <div>
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Creando…" : "Crear aula"}
        </button>
      </div>
    </form>
  );
}

export function ClassroomEditor({
  room,
}: {
  room: {
    id: string;
    name: string;
    semester: string;
    active: boolean;
    arqueo_dif: boolean;
    mensaje: string;
  };
}) {
  const [state, action, pending] = useActionState<PanelState, FormData>(
    saveClassroom,
    null,
  );

  return (
    <form className="card stack" action={action}>
      <input type="hidden" name="id" value={room.id} />
      <div className="fgrid">
        <label className="f">
          Nombre
          <input className="in" name="name" defaultValue={room.name} required />
        </label>
        <label className="f">
          Semestre
          <input className="in" name="semester" defaultValue={room.semester} required />
        </label>
      </div>
      <label className="f">
        Mensaje para el aula
        <input className="in" name="mensaje" defaultValue={room.mensaje} />
      </label>
      <label className="chk">
        <input type="checkbox" name="active" defaultChecked={room.active} />
        <span>Activa: los alumnos pueden elegirla al registrarse</span>
      </label>
      <label className="chk">
        <input type="checkbox" name="arqueo_dif" defaultChecked={room.arqueo_dif} />
        <span>El arqueo puede traer diferencia</span>
      </label>
      <ErrorText error={state?.error} />
      <div>
        <button className="btn quiet sm" type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar aula"}
        </button>
      </div>
    </form>
  );
}

export function CreateCargoForm({ classroomId }: { classroomId: string }) {
  const [state, action, pending] = useActionState<PanelState, FormData>(createCargo, null);

  return (
    <form className="stack" action={action}>
      <input type="hidden" name="classroom_id" value={classroomId} />
      <div className="fgrid">
        <label className="f">
          Nuevo cargo
          <input className="in" name="name" placeholder="Ej.: revisor fiscal" required />
        </label>
      </div>
      <label className="chk">
        <input type="checkbox" name="label_only" defaultChecked />
        <span>Solo nombre: al asignarse puede hacer el trabajo y no borra la empresa</span>
      </label>
      <ErrorText error={state?.error} />
      <div>
        <button className="btn quiet sm" type="submit" disabled={pending}>
          {pending ? "Agregando…" : "Agregar cargo"}
        </button>
      </div>
    </form>
  );
}

export function CargoRow({
  cargo,
}: {
  cargo: { id: string; name: string; label_only: boolean };
}) {
  const [state, action, pending] = useActionState<PanelState, FormData>(saveCargo, null);

  return (
    <form className="row" action={action}>
      <input type="hidden" name="cargo_id" value={cargo.id} />
      <b style={{ minWidth: 160 }}>{cargo.name}</b>
      <label className="chk">
        <input type="checkbox" name="label_only" defaultChecked={cargo.label_only} />
        <span>Solo nombre</span>
      </label>
      <button className="btn quiet sm" type="submit" disabled={pending}>
        {pending ? "Guardando…" : "Guardar"}
      </button>
      <ErrorText error={state?.error} />
    </form>
  );
}

export function CreatePersonalCompanyForm({
  classroomId,
  students,
  cargos,
}: {
  classroomId: string;
  students: { id: string; full_name: string }[];
  cargos: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState<PanelState, FormData>(
    createEmptyCompany,
    null,
  );
  const defaultCargo = cargos.find((cargo) => cargo.name === "contador")?.id ?? cargos[0]?.id ?? "";

  return (
    <form className="stack" action={action}>
      <input type="hidden" name="classroom_id" value={classroomId} />
      <input type="hidden" name="kind" value="personal" />
      <h3>Empresa personal</h3>
      <p className="small muted">
        Queda vacía. El alumno completa razón social, NIT, saldos y catálogo. Es la que cuenta para la ruta.
      </p>
      {students.length === 0 || cargos.length === 0 ? (
        <p className="empty">Primero suma un alumno al aula.</p>
      ) : (
        <div className="fgrid">
          <label className="f">
            Alumno
            <select className="in" name="student_id" required defaultValue="">
              <option value="" disabled>
                Elige el alumno
              </option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.full_name || "Sin nombre"}
                </option>
              ))}
            </select>
          </label>
          <label className="f">
            Cargo inicial
            <select className="in" name="cargo_id" required defaultValue={defaultCargo}>
              {cargos.map((cargo) => (
                <option key={cargo.id} value={cargo.id}>
                  {cargo.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      <ErrorText error={state?.error} />
      <div>
        <button className="btn quiet sm" type="submit" disabled={pending || students.length === 0}>
          {pending ? "Creando…" : "Crear empresa personal"}
        </button>
      </div>
    </form>
  );
}

export function CreateTeamCompanyForm({ classroomId }: { classroomId: string }) {
  const [state, action, pending] = useActionState<PanelState, FormData>(
    createEmptyCompany,
    null,
  );

  return (
    <form className="stack" action={action}>
      <input type="hidden" name="classroom_id" value={classroomId} />
      <input type="hidden" name="kind" value="equipo" />
      <h3>Empresa de equipo</h3>
      <p className="small muted">
        Ejercicio aparte de la nota. Luego metes a los alumnos y cada uno elige su cargo.
      </p>
      <ErrorText error={state?.error} />
      <div>
        <button className="btn quiet sm" type="submit" disabled={pending}>
          {pending ? "Creando…" : "Crear empresa de equipo"}
        </button>
      </div>
    </form>
  );
}

export function CompanyCard({
  company,
  members,
  students,
  cargos,
  actions,
}: {
  company: {
    id: string;
    kind: "personal" | "equipo";
    completed: boolean;
    razon: string | null;
  };
  members: { id: string; userId: string; name: string; cargoName: string }[];
  students: { id: string; full_name: string }[];
  cargos: { id: string; name: string }[];
  actions: { memberId: string; action: string; level: string }[];
}) {
  const [resetState, reset, resetPending] = useActionState<PanelState, FormData>(
    resetCompany,
    null,
  );

  return (
    <div className="card stack">
      <div className="spread">
        <div>
          <b>{companyLabel(company)}</b>
          <div className="small muted">
            {kindLabel(company.kind)} · {company.completed ? "Completa" : "Vacía"}
          </div>
        </div>
        <form
          action={reset}
          onSubmit={(event) => {
            if (!window.confirm("Se borra la empresa. Los archivos del repositorio se conservan.")) {
              event.preventDefault();
            }
          }}
        >
          <input type="hidden" name="company_id" value={company.id} />
          <button className="btn quiet sm" type="submit" disabled={resetPending}>
            Borrar empresa
          </button>
        </form>
      </div>
      <AddMemberForm companyId={company.id} students={students} cargos={cargos} />
      {members.length === 0 ? (
        <p className="empty">Todavía no hay alumnos en esta empresa.</p>
      ) : (
        members.map((member) => (
          <MemberBlock
            key={member.id}
            member={member}
            levels={Object.fromEntries(
              actions
                .filter((row) => row.memberId === member.id)
                .map((row) => [row.action, row.level]),
            )}
          />
        ))
      )}
      <ErrorText error={resetState?.error} />
    </div>
  );
}

function AddMemberForm({
  companyId,
  students,
  cargos,
}: {
  companyId: string;
  students: { id: string; full_name: string }[];
  cargos: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState<PanelState, FormData>(addMember, null);
  const defaultCargo = cargos.find((cargo) => cargo.name === "auxiliar contable")?.id ?? "";

  return (
    <form className="row" action={action}>
      <input type="hidden" name="company_id" value={companyId} />
      <label className="f" style={{ flex: "1 1 180px" }}>
        Alumno
        <select className="in" name="student_id" required defaultValue="">
          <option value="" disabled>
            Meter alumno
          </option>
          {students.map((student) => (
            <option key={student.id} value={student.id}>
              {student.full_name || "Sin nombre"}
            </option>
          ))}
        </select>
      </label>
      <label className="f" style={{ flex: "1 1 180px" }}>
        Cargo
        <select className="in" name="cargo_id" required defaultValue={defaultCargo}>
          {cargos.map((cargo) => (
            <option key={cargo.id} value={cargo.id}>
              {cargo.name}
            </option>
          ))}
        </select>
      </label>
      <button className="btn quiet sm" type="submit" disabled={pending || students.length === 0}>
        {pending ? "Metiendo…" : "Meter"}
      </button>
      <ErrorText error={state?.error} />
    </form>
  );
}

function MemberBlock({
  member,
  levels,
}: {
  member: { id: string; name: string; cargoName: string };
  levels: Record<string, string>;
}) {
  const [removeState, remove, removePending] = useActionState<PanelState, FormData>(
    removeMember,
    null,
  );
  const [saveState, save, savePending] = useActionState<PanelState, FormData>(
    saveMemberActions,
    null,
  );

  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="spread">
        <div>
          <b>{member.name}</b>
          <div className="small muted">Cargo: {member.cargoName}</div>
        </div>
        <form action={remove}>
          <input type="hidden" name="member_id" value={member.id} />
          <button className="btn quiet sm" type="submit" disabled={removePending}>
            Sacar
          </button>
        </form>
      </div>
      <form className="stack" action={save}>
        <input type="hidden" name="member_id" value={member.id} />
        <div className="tbl-wrap">
          <table className="t">
            <thead>
              <tr>
                <th>Qué puede hacer</th>
                <th>En esta membresía</th>
              </tr>
            </thead>
            <tbody>
              {ACTIONS.map(([key, label]) => (
                <tr key={key}>
                  <td>{label}</td>
                  <td>
                    <select className="in" name={key} defaultValue={levels[key] ?? "hide"}>
                      <option value="do">Hacer</option>
                      <option value="view">Ver</option>
                      <option value="hide">No ver</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ErrorText error={saveState?.error ?? removeState?.error} />
        <div>
          <button className="btn quiet sm" type="submit" disabled={savePending}>
            {savePending ? "Guardando…" : "Guardar acciones"}
          </button>
        </div>
      </form>
    </div>
  );
}

export function StudentRow({
  student,
  classrooms,
  memberships,
  companies,
}: {
  student: { id: string; full_name: string };
  classrooms: { id: string; name: string; semester: string }[];
  memberships: { classroomId: string }[];
  companies: { id: string; classroomId: string; razon: string | null; finished: number; total: number }[];
}) {
  const [addState, add, addPending] = useActionState<PanelState, FormData>(addToClassroom, null);
  const joined = new Set(memberships.map((item) => item.classroomId));
  const available = classrooms.filter((room) => !joined.has(room.id));

  return (
    <div className="card stack">
      <div className="spread">
        <div>
          <b>{student.full_name || "Sin nombre"}</b>
          <div className="small muted">
            {companies.length === 0
              ? "Sin empresa personal"
              : companies
                  .map((company) => company.razon || "Empresa personal")
                  .join(" · ")}
          </div>
        </div>
        <div className="row">
          {companies.map((company) => (
            <span
              key={company.id}
              className={`chip ${company.finished === company.total ? "ok" : "acc"}`}
            >
              {company.finished} de {company.total}
            </span>
          ))}
          <Link className="btn quiet sm" href={`/panel/estudiante/${student.id}`}>
            Ver avance
          </Link>
        </div>
      </div>
      {memberships.length === 0 ? (
        <p className="small muted">Sin aula.</p>
      ) : (
        memberships.map((membership) => {
          const room = classrooms.find((item) => item.id === membership.classroomId);
          return (
            <RemoveClassroomForm
              key={membership.classroomId}
              studentId={student.id}
              classroomId={membership.classroomId}
              label={room ? `${room.name} · ${room.semester}` : "Aula"}
            />
          );
        })
      )}
      <form className="row" action={add}>
        <input type="hidden" name="student_id" value={student.id} />
        <label className="f" style={{ flex: "1 1 220px" }}>
          Sumar a un aula
          <select className="in" name="classroom_id" defaultValue="">
            <option value="">Elige un aula</option>
            {available.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name} · {room.semester}
              </option>
            ))}
          </select>
        </label>
        <button className="btn quiet sm" type="submit" disabled={addPending || available.length === 0}>
          Sumar
        </button>
      </form>
      <ErrorText error={addState?.error} />
    </div>
  );
}

function RemoveClassroomForm({
  studentId,
  classroomId,
  label,
}: {
  studentId: string;
  classroomId: string;
  label: string;
}) {
  const [state, action, pending] = useActionState<PanelState, FormData>(
    removeFromClassroom,
    null,
  );

  return (
    <form className="row" action={action}>
      <input type="hidden" name="student_id" value={studentId} />
      <input type="hidden" name="classroom_id" value={classroomId} />
      <span className="small">{label}</span>
      <button className="btn quiet sm" type="submit" disabled={pending}>
        Quitar del aula
      </button>
      <ErrorText error={state?.error} />
    </form>
  );
}
