"use client";

import { useActionState } from "react";
import { chooseCargo, type WorkspaceState } from "@/app/workspace/actions";

export function CargoForm({
  memberships,
  cargos,
}: {
  memberships: { id: string; cargoId: string; cargoName: string }[];
  cargos: { id: string; name: string }[];
}) {
  if (memberships.length === 0) return null;

  return (
    <div className="card stack">
      <h3>Tu cargo</h3>
      <p className="small muted">
        El documento queda firmado con el cargo que elijas. Si lo cambias, las acciones vuelven al inicio y el docente las vuelve a marcar.
      </p>
      {memberships.map((membership) => (
        <CargoChoice key={membership.id} membership={membership} cargos={cargos} />
      ))}
    </div>
  );
}

function CargoChoice({
  membership,
  cargos,
}: {
  membership: { id: string; cargoId: string; cargoName: string };
  cargos: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState<WorkspaceState, FormData>(chooseCargo, null);

  return (
    <form className="row" action={action}>
      <input type="hidden" name="member_id" value={membership.id} />
      <label className="f" style={{ flex: "1 1 220px" }}>
        Cargo
        <select className="in" name="cargo_id" defaultValue={membership.cargoId}>
          {cargos.map((cargo) => (
            <option key={cargo.id} value={cargo.id}>
              {cargo.name}
            </option>
          ))}
          {cargos.some((cargo) => cargo.id === membership.cargoId) ? null : (
            <option value={membership.cargoId}>{membership.cargoName}</option>
          )}
        </select>
      </label>
      <button className="btn quiet sm" type="submit" disabled={pending}>
        {pending ? "Guardando…" : "Elegir cargo"}
      </button>
      {state?.error ? (
        <p className="note bad" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
