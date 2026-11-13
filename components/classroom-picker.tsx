"use client";

import { useActionState } from "react";
import { chooseClassroom, type AuthState } from "@/app/ingreso/actions";

export function ClassroomPicker({
  classrooms,
}: {
  classrooms: { id: string; name: string; semester: string }[];
}) {
  const [state, action, pending] = useActionState<AuthState, FormData>(
    chooseClassroom,
    null,
  );

  return (
    <form className="card stack" action={action} style={{ maxWidth: 520 }}>
      <h1>Elige tu aula</h1>
      <p className="muted">
        El docente crea las aulas. Cuando elijas una, puede crear tu empresa personal.
      </p>
      {classrooms.length === 0 ? (
        <p className="empty">Todavía no hay aulas activas.</p>
      ) : (
        <label className="f">
          Aula
          <select className="in" name="classroom_id" required defaultValue="">
            <option value="" disabled>
              Elige tu aula
            </option>
            {classrooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name} · {room.semester}
              </option>
            ))}
          </select>
        </label>
      )}
      {state?.error ? (
        <p className="note bad" role="alert">
          {state.error}
        </p>
      ) : null}
      <button className="btn" type="submit" disabled={pending || classrooms.length === 0}>
        {pending ? "Guardando…" : "Continuar"}
      </button>
    </form>
  );
}
