"use client";

import { useActionState } from "react";
import {
  assignClassroom,
  createClassroom,
  resetCompany,
  saveClassroom,
  type PanelState,
} from "@/app/panel/actions";

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
        <span>Activa: los estudiantes pueden elegirla al registrarse</span>
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

export function StudentRow({
  student,
  classrooms,
  company,
}: {
  student: { id: string; full_name: string; classroom_id: string | null };
  classrooms: { id: string; name: string; semester: string }[];
  company: { id: string; razon: string } | null;
}) {
  const [assignState, assign, assignPending] = useActionState<PanelState, FormData>(
    assignClassroom,
    null,
  );
  const [resetState, reset, resetPending] = useActionState<PanelState, FormData>(
    resetCompany,
    null,
  );

  return (
    <div className="card stack">
      <div className="spread">
        <div>
          <b>{student.full_name || "Sin nombre"}</b>
          <div className="small muted">{company ? company.razon : "Sin empresa"}</div>
        </div>
      </div>
      <form className="row" action={assign}>
        <input type="hidden" name="student_id" value={student.id} />
        <label className="f" style={{ flex: "1 1 220px" }}>
          Aula
          <select className="in" name="classroom_id" defaultValue={student.classroom_id ?? ""}>
            <option value="">Sin aula</option>
            {classrooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name} · {room.semester}
              </option>
            ))}
          </select>
        </label>
        <button className="btn quiet sm" type="submit" disabled={assignPending}>
          Mover
        </button>
      </form>
      {company ? (
        <form
          action={reset}
          onSubmit={(event) => {
            if (!window.confirm("Se borra la empresa de práctica. Los archivos del repositorio se conservan.")) {
              event.preventDefault();
            }
          }}
        >
          <input type="hidden" name="company_id" value={company.id} />
          <button className="btn quiet sm" type="submit" disabled={resetPending}>
            Reiniciar empresa
          </button>
        </form>
      ) : null}
      <ErrorText error={assignState?.error ?? resetState?.error} />
    </div>
  );
}
