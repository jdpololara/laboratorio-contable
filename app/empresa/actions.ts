"use server";

import { redirect } from "next/navigation";
import { dbError } from "@/lib/auth-error";
import {
  addDays,
  CATALOGO_EJEMPLO,
  CONSUMIDOR_FINAL,
  openingIdentity,
  TERCEROS_EJEMPLO,
} from "@/lib/lab/seed";
import { requireViewer } from "@/lib/session";

export type SetupState = { error?: string } | null;

function amount(value: FormDataEntryValue | null) {
  const digits = String(value ?? "").replace(/[^\d]/g, "");
  if (!digits) return 0;
  const parsed = Number(digits);
  if (!Number.isSafeInteger(parsed) || parsed > 9_999_999_999_999) return null;
  return parsed;
}

export async function createCompany(
  _state: SetupState,
  formData: FormData,
): Promise<SetupState> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const razon = String(formData.get("razon") ?? "").trim();
  const nit = String(formData.get("nit") ?? "").trim();
  const ciudad = String(formData.get("ciudad") ?? "").trim();
  const direccion = String(formData.get("direccion") ?? "").trim();
  const mes = String(formData.get("mes") ?? "");
  const caja = amount(formData.get("caja"));
  const banco = amount(formData.get("banco"));

  if (!fullName) return { error: "Escribe tu nombre." };
  if (!razon) return { error: "Escribe la razón social." };
  if (!nit) return { error: "Escribe el NIT." };
  if (!/^\d{4}-\d{2}$/.test(mes)) return { error: "Elige el mes de inicio." };
  if (caja == null || banco == null) return { error: "Revisa los saldos iniciales." };

  const { supabase, viewer } = await requireViewer();
  if (viewer.role !== "student") redirect("/panel");
  if (!viewer.classroomId) return { error: "Elige un aula antes de crear la empresa." };

  const inicio = `${mes}-01`;
  const identity = openingIdentity(nit, razon);
  const catalogo = formData.get("catalogo") === "on";

  const { error } = await supabase.rpc("crear_empresa", {
    payload: {
      full_name: fullName,
      razon,
      nit,
      ciudad,
      direccion,
      work_date: inicio,
      accounting_start: inicio,
      resol_numero: identity.resolNumero,
      resol_fecha: addDays(inicio, -20),
      resol_prefijo: "FE",
      resol_desde: 1,
      resol_hasta: 5000,
      banco_nombre: "Banco del Altiplano",
      banco_cuenta: identity.bancoCuenta,
      banco_cheque_ini: identity.chequeIni,
      banco_saldo0: banco,
      caja,
      terceros: catalogo ? TERCEROS_EJEMPLO : CONSUMIDOR_FINAL,
      productos: catalogo ? CATALOGO_EJEMPLO : [],
    },
  });

  if (error) return { error: dbError(error.message) };
  redirect("/");
}
