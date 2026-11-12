"use client";

import { useActionState, useState } from "react";
import { authenticate, type AuthState } from "@/app/ingreso/actions";

type Classroom = { id: string; name: string; semester: string };

export function AuthForm({
  classrooms,
  notice,
}: {
  classrooms: Classroom[];
  notice?: string;
}) {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [state, action, pending] = useActionState<AuthState, FormData>(
    authenticate,
    null,
  );

  return (
    <div className="gate">
      <div className="card stack">
        <div>
          <p className="eyebrow">Contaduría pública · práctica</p>
          <h1>Laboratorio Contable</h1>
          <p className="lead" style={{ marginTop: 8 }}>
            Entra con tu cuenta. Si eres estudiante, elige el aula que creó el docente.
          </p>
        </div>
        <div className="tabs">
          <button
            className="btn quiet sm"
            type="button"
            aria-pressed={mode === "in"}
            onClick={() => setMode("in")}
          >
            Ingresar
          </button>
          <button
            className="btn quiet sm"
            type="button"
            aria-pressed={mode === "up"}
            onClick={() => setMode("up")}
          >
            Crear cuenta
          </button>
        </div>
        <form className="stack" action={action}>
          <input type="hidden" name="intent" value={mode} />
          {mode === "up" ? (
            <label className="f">
              Nombre completo
              <input className="in" name="full_name" autoComplete="name" required />
            </label>
          ) : null}
          <label className="f">
            Correo
            <input className="in" name="email" type="email" autoComplete="email" required />
          </label>
          <label className="f">
            Contraseña
            <input
              className="in"
              name="password"
              type="password"
              autoComplete={mode === "up" ? "new-password" : "current-password"}
              minLength={6}
              required
            />
          </label>
          {mode === "up" ? (
            <label className="f">
              Aula
              <select className="in" name="classroom_id" required defaultValue="">
                <option value="" disabled>
                  {classrooms.length ? "Elige tu aula" : "Todavía no hay aulas activas"}
                </option>
                {classrooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name} · {room.semester}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {notice || state?.notice ? (
            <p className="note" role="status">
              {state?.notice ?? notice}
            </p>
          ) : null}
          {state?.error ? (
            <p className="note bad" role="alert">
              {state.error}
            </p>
          ) : null}
          <button className="btn" type="submit" disabled={pending || (mode === "up" && classrooms.length === 0)}>
            {pending ? "Un momento…" : mode === "up" ? "Crear cuenta" : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}
