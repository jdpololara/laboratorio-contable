"use server";

import { redirect } from "next/navigation";
import { ACTIONS } from "@/lib/lab/membership";
import { dbError } from "@/lib/auth-error";
import { requireViewer } from "@/lib/session";

export type PanelState = { error?: string } | null;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function uuid(value: FormDataEntryValue | null) {
  const text = String(value ?? "");
  return UUID.test(text) ? text : null;
}

function amount(value: FormDataEntryValue | null) {
  const digits = String(value ?? "").replace(/[^\d]/g, "");
  if (!digits) return 0;
  const parsed = Number(digits);
  if (!Number.isSafeInteger(parsed) || parsed > 9_999_999_999_999) return null;
  return parsed;
}

async function adminClient() {
  const { supabase, viewer } = await requireViewer();
  if (viewer.role !== "admin") redirect("/");
  return supabase;
}

export async function createClassroom(
  _state: PanelState,
  formData: FormData,
): Promise<PanelState> {
  const name = String(formData.get("name") ?? "").trim();
  const semester = String(formData.get("semester") ?? "").trim();
  if (!name || !semester) return { error: "Escribe el nombre y el semestre." };

  const supabase = await adminClient();
  const { data } = await supabase.auth.getClaims();
  const { error } = await supabase.from("classrooms").insert({
    name,
    semester,
    created_by: data?.claims?.sub,
  });

  if (error) return { error: dbError(error.message) };
  redirect("/panel");
}

export async function saveClassroom(
  _state: PanelState,
  formData: FormData,
): Promise<PanelState> {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const semester = String(formData.get("semester") ?? "").trim();
  const mensaje = String(formData.get("mensaje") ?? "");
  if (!name || !semester) return { error: "El aula necesita nombre y semestre." };

  const supabase = await adminClient();
  const { error } = await supabase
    .from("classrooms")
    .update({
      name,
      semester,
      mensaje,
      active: formData.get("active") === "on",
      arqueo_dif: formData.get("arqueo_dif") === "on",
    })
    .eq("id", id);

  if (error) return { error: dbError(error.message) };
  redirect("/panel");
}

export async function addToClassroom(
  _state: PanelState,
  formData: FormData,
): Promise<PanelState> {
  const studentId = uuid(formData.get("student_id"));
  const classroomId = uuid(formData.get("classroom_id"));
  if (!studentId || !classroomId) return { error: "Elige el aula." };

  const supabase = await adminClient();
  const { data: existing } = await supabase
    .from("classroom_members")
    .select("user_id")
    .eq("user_id", studentId)
    .eq("classroom_id", classroomId)
    .maybeSingle();
  if (existing) return { error: "Ese alumno ya está en el aula." };

  const { error } = await supabase.from("classroom_members").insert({
    user_id: studentId,
    classroom_id: classroomId,
  });
  if (error) return { error: dbError(error.message) };

  const { data: profile } = await supabase
    .from("profiles")
    .select("classroom_id")
    .eq("id", studentId)
    .maybeSingle();
  if (profile && !profile.classroom_id) {
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ classroom_id: classroomId })
      .eq("id", studentId)
      .eq("role", "student");
    if (profileError) return { error: dbError(profileError.message) };
  }

  redirect("/panel");
}

export async function removeFromClassroom(
  _state: PanelState,
  formData: FormData,
): Promise<PanelState> {
  const studentId = uuid(formData.get("student_id"));
  const classroomId = uuid(formData.get("classroom_id"));
  if (!studentId || !classroomId) return { error: "No se pudo quitar el aula." };

  const supabase = await adminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("classroom_id")
    .eq("id", studentId)
    .maybeSingle();

  const { error } = await supabase
    .from("classroom_members")
    .delete()
    .eq("user_id", studentId)
    .eq("classroom_id", classroomId);
  if (error) return { error: dbError(error.message) };

  if (profile?.classroom_id === classroomId) {
    const { data: rest } = await supabase
      .from("classroom_members")
      .select("classroom_id")
      .eq("user_id", studentId)
      .limit(1);
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ classroom_id: rest?.[0]?.classroom_id ?? null })
      .eq("id", studentId)
      .eq("role", "student");
    if (profileError) return { error: dbError(profileError.message) };
  }

  redirect("/panel");
}

export async function createCargo(
  _state: PanelState,
  formData: FormData,
): Promise<PanelState> {
  const classroomId = uuid(formData.get("classroom_id"));
  const name = String(formData.get("name") ?? "").trim();
  if (!classroomId || !name) return { error: "Escribe el nombre del cargo." };

  const supabase = await adminClient();
  const { error } = await supabase.from("cargos").insert({
    classroom_id: classroomId,
    name,
    label_only: formData.get("label_only") === "on",
  });
  if (error) {
    if (/unique|duplicate|ya está/i.test(error.message)) {
      return { error: "Ese cargo ya está en el aula." };
    }
    return { error: dbError(error.message) };
  }
  redirect("/panel");
}

export async function saveCargo(
  _state: PanelState,
  formData: FormData,
): Promise<PanelState> {
  const cargoId = uuid(formData.get("cargo_id"));
  if (!cargoId) return { error: "No se pudo guardar el cargo." };

  const supabase = await adminClient();
  const { error } = await supabase
    .from("cargos")
    .update({ label_only: formData.get("label_only") === "on" })
    .eq("id", cargoId);
  if (error) return { error: dbError(error.message) };
  redirect("/panel");
}

export async function createEmptyCompany(
  _state: PanelState,
  formData: FormData,
): Promise<PanelState> {
  const classroomId = uuid(formData.get("classroom_id"));
  const kind = formData.get("kind") === "equipo" ? "equipo" : "personal";
  const studentId = uuid(formData.get("student_id"));
  const cargoId = uuid(formData.get("cargo_id"));
  if (!classroomId) return { error: "Elige el aula." };
  if (kind === "personal" && (!studentId || !cargoId)) {
    return { error: "Elige el alumno y el cargo de la empresa personal." };
  }

  const supabase = await adminClient();
  const { data: companyId, error } = await supabase.rpc("crear_empresa_vacia", {
    p_classroom: classroomId,
    p_kind: kind,
    p_student: kind === "personal" ? studentId : null,
  });
  if (error || !companyId) return { error: dbError(error?.message ?? "") };

  if (kind === "personal" && studentId && cargoId) {
    const { error: memberError } = await supabase.from("company_members").insert({
      company_id: companyId,
      user_id: studentId,
      cargo_id: cargoId,
    });
    if (memberError) return { error: dbError(memberError.message) };
  }

  redirect("/panel");
}

export async function addMember(
  _state: PanelState,
  formData: FormData,
): Promise<PanelState> {
  const companyId = uuid(formData.get("company_id"));
  const studentId = uuid(formData.get("student_id"));
  const cargoId = uuid(formData.get("cargo_id"));
  if (!companyId || !studentId || !cargoId) {
    return { error: "Elige el alumno y el cargo." };
  }

  const supabase = await adminClient();
  const { error } = await supabase.from("company_members").insert({
    company_id: companyId,
    user_id: studentId,
    cargo_id: cargoId,
  });
  if (error) {
    if (/unique|duplicate/i.test(error.message)) {
      return { error: "Ese alumno ya tiene ese cargo en la empresa." };
    }
    return { error: dbError(error.message) };
  }
  redirect("/panel");
}

export async function removeMember(
  _state: PanelState,
  formData: FormData,
): Promise<PanelState> {
  const memberId = uuid(formData.get("member_id"));
  if (!memberId) return { error: "No se pudo sacar al alumno." };

  const supabase = await adminClient();
  const { error } = await supabase.from("company_members").delete().eq("id", memberId);
  if (error) return { error: dbError(error.message) };
  redirect("/panel");
}

export async function saveMemberActions(
  _state: PanelState,
  formData: FormData,
): Promise<PanelState> {
  const memberId = uuid(formData.get("member_id"));
  if (!memberId) return { error: "No se pudo guardar la membresía." };

  const supabase = await adminClient();
  for (const [key] of ACTIONS) {
    const level = String(formData.get(key) ?? "");
    if (level !== "do" && level !== "view" && level !== "hide") {
      return { error: "Elige hacer, ver o no ver." };
    }
    const { error } = await supabase
      .from("company_member_actions")
      .update({ level })
      .eq("member_id", memberId)
      .eq("action", key);
    if (error) return { error: dbError(error.message) };
  }

  redirect("/panel");
}

export async function resetCompany(
  _state: PanelState,
  formData: FormData,
): Promise<PanelState> {
  const companyId = String(formData.get("company_id") ?? "");
  const supabase = await adminClient();
  const { error } = await supabase.from("companies").delete().eq("id", companyId);
  if (error) return { error: dbError(error.message) };
  redirect("/panel");
}

export async function correctLine(
  _state: PanelState,
  formData: FormData,
): Promise<PanelState> {
  const lineId = uuid(formData.get("linea_id"));
  const studentId = uuid(formData.get("student_id"));
  const companyId = uuid(formData.get("company_id"));
  const cuenta = String(formData.get("cuenta") ?? "").trim();
  const detalle = String(formData.get("detalle") ?? "").trim();
  const debito = amount(formData.get("debito"));
  const credito = amount(formData.get("credito"));
  if (!lineId || !studentId || !companyId) return { error: "No se pudo corregir la línea." };
  if (!cuenta) return { error: "Elige la cuenta." };
  if (debito == null || credito == null) return { error: "Revisa el valor." };
  if ((debito > 0) === (credito > 0)) {
    return { error: "El movimiento va al débito o al crédito." };
  }

  const supabase = await adminClient();
  const { error } = await supabase
    .from("lineas_asiento")
    .update({ cuenta, detalle, debito, credito })
    .eq("id", lineId);
  if (error) return { error: dbError(error.message) };
  redirect(`/panel/estudiante/${studentId}/diario?empresa=${companyId}`);
}
