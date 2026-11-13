"use client";

import { useActionState } from "react";
import { completeCompany, type SetupState } from "@/app/empresa/actions";
import { monthOptions } from "@/lib/lab/seed";

export function SetupForm({
  fullName,
  companyId,
  kind,
}: {
  fullName: string;
  companyId: string;
  kind: "personal" | "equipo";
}) {
  const [state, action, pending] = useActionState<SetupState, FormData>(
    completeCompany,
    null,
  );
  const months = monthOptions();
  const personal = kind === "personal";

  return (
    <form className="stack" action={action} style={{ maxWidth: 860 }}>
      <input type="hidden" name="company_id" value={companyId} />
      <div>
        <span className="eyebrow">Empresa vacía</span>
        <h1>{personal ? "Completa tu empresa personal" : "Completa la empresa de equipo"}</h1>
        <p className="lead" style={{ marginTop: 6 }}>
          {personal
            ? "El docente dejó esta empresa vacía. Al completarla queda la que cuenta para la ruta del taller: vender, facturar, comprar, pagar, cuadrar la caja y conciliar el banco."
            : "Esta empresa de equipo está vacía. Quien tenga permiso completa la razón social, el NIT y los saldos. Es un ejercicio aparte de la nota."}
        </p>
      </div>
      <div className="card stack">
        <h3>Tus datos</h3>
        <label className="f">
          Nombre completo
          <input
            className="in"
            name="full_name"
            autoComplete="name"
            placeholder="Ej.: Laura Gómez Restrepo"
            defaultValue={fullName}
            required
          />
        </label>
      </div>
      <div className="card stack">
        <h3>Datos de la empresa</h3>
        <div className="fgrid">
          <label className="f">
            Razón social
            <input className="in" name="razon" placeholder="Ej.: Papelería El Estudiante S.A.S." required />
          </label>
          <label className="f">
            NIT
            <input className="in" name="nit" placeholder="Ej.: 901.555.123-4" required />
          </label>
          <label className="f">
            Ciudad
            <input className="in" name="ciudad" defaultValue="Medellín" />
          </label>
          <label className="f">
            Dirección
            <input className="in" name="direccion" placeholder="Ej.: Calle 50 # 40-20" />
          </label>
          <label className="f">
            Mes en que inicia la contabilidad
            <select className="in" name="mes" defaultValue="2026-11">
              {months.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <div className="card stack">
        <h3>Saldos iniciales</h3>
        <p className="small muted">
          Con estos saldos y el inventario inicial se registra el asiento de apertura contra el capital de los socios.
        </p>
        <div className="fgrid">
          <label className="f">
            Efectivo en caja
            <input className="in" name="caja" inputMode="numeric" defaultValue="500000" />
          </label>
          <label className="f">
            Saldo en Banco del Altiplano
            <input className="in" name="banco" inputMode="numeric" defaultValue="15000000" />
          </label>
        </div>
        <label className="chk">
          <input type="checkbox" name="catalogo" defaultChecked />
          <span>Cargar catálogo de papelería con inventario inicial y terceros de ejemplo (recomendado)</span>
        </label>
      </div>
      {state?.error ? (
        <p className="note bad" role="alert">
          {state.error}
        </p>
      ) : null}
      <div>
        <button className="btn lg" type="submit" disabled={pending}>
          {pending ? "Completando…" : "Completar la empresa"}
        </button>
      </div>
    </form>
  );
}
