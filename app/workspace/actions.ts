"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { dbError } from "@/lib/auth-error";
import { requireViewer } from "@/lib/session";

export type WorkspaceState = { error?: string } | null;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COOKIE = {
  path: "/",
  httpOnly: true,
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 180,
};

function uuid(value: FormDataEntryValue | null) {
  const text = String(value ?? "");
  return UUID.test(text) ? text : null;
}

export async function chooseClassroomWork(
  _state: WorkspaceState,
  formData: FormData,
): Promise<WorkspaceState> {
  const { viewer } = await requireViewer();
  if (viewer.role !== "student") redirect("/panel");

  const classroomId = uuid(formData.get("classroom_id"));
  if (!classroomId || !viewer.classrooms.some((room) => room.id === classroomId)) {
    return { error: "Esa aula no es tuya." };
  }

  const cookieStore = await cookies();
  cookieStore.set("lab_aula", classroomId, COOKIE);
  cookieStore.delete("lab_empresa");
  redirect("/");
}

export async function chooseCompanyWork(
  _state: WorkspaceState,
  formData: FormData,
): Promise<WorkspaceState> {
  const { viewer } = await requireViewer();
  if (viewer.role !== "student") redirect("/panel");

  const companyId = uuid(formData.get("company_id"));
  const company = viewer.companies.find((item) => item.id === companyId);
  if (!company) return { error: "Esa empresa no es tuya." };

  const cookieStore = await cookies();
  cookieStore.set("lab_aula", company.classroomId, COOKIE);
  cookieStore.set("lab_empresa", company.id, COOKIE);
  redirect("/");
}

export async function chooseCargo(
  _state: WorkspaceState,
  formData: FormData,
): Promise<WorkspaceState> {
  const { supabase, viewer } = await requireViewer();
  if (viewer.role !== "student") redirect("/panel");

  const memberId = uuid(formData.get("member_id"));
  const cargoId = uuid(formData.get("cargo_id"));
  const membership = viewer.memberships.find((member) => member.id === memberId);
  if (!membership || !cargoId) return { error: "Elige un cargo." };
  if (membership.cargoId === cargoId) redirect("/");

  const { error } = await supabase
    .from("company_members")
    .update({ cargo_id: cargoId })
    .eq("id", membership.id)
    .eq("user_id", viewer.id);
  if (error) {
    if (/unique|duplicate/i.test(error.message)) {
      return { error: "Ya tienes ese cargo en esta empresa." };
    }
    return { error: dbError(error.message) };
  }
  redirect("/");
}
