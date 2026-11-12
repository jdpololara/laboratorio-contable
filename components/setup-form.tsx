"use client";

import { useActionState } from "react";
import { createCompany, type SetupState } from "@/app/empresa/actions";
import { monthOptions } from "@/lib/lab/seed";

export function SetupForm({ fullName }: { fullName: string }) {
  const [state, action, pending] = useActionState<SetupState, FormData>(
    createCompany,
    null,
  );
  const months = monthOptions();

  return (
    <form className="stack" action={action} style={{ maxWidth: 860 }}>
      <div>
        <span className="eyebrow">Paso inicial</span>
        <h1>Crea tu empresa de práctica</h1>
        <p className="lead" style={{ marginTop: 6 }}>
          Vas a llevar la contabilidad de una comercializadora: vender en el punto de venta,
          facturar, comprar, pagar, cuadrar la caja y conciliar el banco. Todo lo que registres
          se convierte en asientos contables.
        </p>
      </div>
      <div className="card stack">
        <h3>Tus datos</h3>
        <label className="f">
          Nombre completo del estudiante
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
          {pending ? "Creando…" : "Crear mi empresa"}
        </button>
      </div>
    </form>
  );
}
