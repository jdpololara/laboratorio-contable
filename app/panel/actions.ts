"use server";

import { redirect } from "next/navigation";
import { dbError } from "@/lib/auth-error";
import { requireViewer } from "@/lib/session";

export type PanelState = { error?: string } | null;

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

export async function assignClassroom(
  _state: PanelState,
  formData: FormData,
): Promise<PanelState> {
  const studentId = String(formData.get("student_id") ?? "");
  const classroomId = String(formData.get("classroom_id") ?? "");
  const supabase = await adminClient();
  const { error } = await supabase
    .from("profiles")
    .update({ classroom_id: classroomId || null })
    .eq("id", studentId)
    .eq("role", "student");

  if (error) return { error: dbError(error.message) };
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
