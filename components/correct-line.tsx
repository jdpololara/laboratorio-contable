"use client";

import { useActionState } from "react";
import { correctLine, type PanelState } from "@/app/panel/actions";

export function CorrectLineForm({
  line,
  accounts,
  studentId,
  companyId,
}: {
  line: { id: string; cuenta: string; debito: number; credito: number; detalle: string };
  accounts: { codigo: string; nombre: string }[];
  studentId: string;
  companyId: string;
}) {
  const [state, action, pending] = useActionState<PanelState, FormData>(correctLine, null);

  return (
    <form className="stack" action={action} style={{ gap: 8 }}>
      <input type="hidden" name="linea_id" value={line.id} />
      <input type="hidden" name="student_id" value={studentId} />
      <input type="hidden" name="company_id" value={companyId} />
      <div className="fgrid">
        <label className="f">
          Cuenta
          <select className="in" name="cuenta" defaultValue={line.cuenta}>
            {accounts.some((account) => account.codigo === line.cuenta) ? null : (
              <option value={line.cuenta}>{line.cuenta}</option>
            )}
            {accounts.map((account) => (
              <option key={account.codigo} value={account.codigo}>
                {account.codigo} {account.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="f">
          Débito
          <input className="in" name="debito" inputMode="numeric" defaultValue={line.debito || ""} />
        </label>
        <label className="f">
          Crédito
          <input className="in" name="credito" inputMode="numeric" defaultValue={line.credito || ""} />
        </label>
        <label className="f">
          Detalle
          <input className="in" name="detalle" defaultValue={line.detalle} />
        </label>
      </div>
      {state?.error ? (
        <p className="note bad" role="alert">
          {state.error}
        </p>
      ) : null}
      <div>
        <button className="btn quiet sm" type="submit" disabled={pending}>
          {pending ? "Corrigiendo…" : "Corregir línea"}
        </button>
      </div>
    </form>
  );
}
